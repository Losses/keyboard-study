library(lme4)
library(lmerTest)
library(effectsize)
library(performance)
library(doParallel)
library(foreach)
library(ggplot2)
library(tidyr)
library(dplyr)
library(stringr)
library(ggridges)

# ==========================================
# 1. DATA PREPARATION & BASE MODEL FITTING
# ==========================================

df <- read.csv("./lv2.csv")

df$Input_Method <- factor(df$Input_Method)
df$Slot_ID <- factor(df$Slot_ID)

contrasts(df$Input_Method) <- contr.helmert(levels(df$Input_Method))
contrasts(df$Slot_ID) <- contr.sum(levels(df$Slot_ID))

z_score <- function(x) {
  z <- scale(x)
  list(
    values = as.numeric(z),
    center = attr(z, "center")[1],
    scale = attr(z, "scale")[1]
  )
}

ww_z <- z_score(df$Window_Width_mm)
cs_z <- z_score(df$Chars_On_Screen)
iv_z <- z_score(df$Interval_ms)

df$Window_Width_mm_z <- ww_z$values
df$Chars_On_Screen_z <- cs_z$values
df$Interval_ms_z <- iv_z$values

scaling_info <- list(
  Window_Width_mm = list(center = ww_z$center, scale = ww_z$scale),
  Chars_On_Screen = list(center = cs_z$center, scale = cs_z$scale),
  Interval_ms = list(center = iv_z$center, scale = iv_z$scale)
)

model_formula <- Interval_ms_z ~ Input_Method * Slot_ID + Window_Width_mm_z + Chars_On_Screen_z + (1 | Participant_ID / Trial_ID)

base_model <- lme4::lmer(
  model_formula,
  data = df,
  control = lme4::lmerControl(
    optimizer = "bobyqa",
    optCtrl = list(maxfun = 1e5)
  )
)

extract_metrics_raw <- function(fit) {
  beta_star <- lme4::fixef(fit)
  
  eta_sq <- tryCatch({
    fit_lmertest <- lmerTest::as_lmerModLmerTest(fit)
    eta_obj <- effectsize::eta_squared(fit_lmertest, partial = TRUE)
    
    if (is.null(eta_obj) || nrow(eta_obj) == 0) {
      numeric(0)
    } else {
      setNames(
        as.numeric(eta_obj$Eta2_partial),
        paste0("eta2_", eta_obj$Parameter)
      )
    }
  }, error = function(e) numeric(0))
  
  r2_metrics <- tryCatch({
    r2_obj <- performance::r2(fit)
    c(
      R2_marginal = as.numeric(r2_obj$R2_marginal),
      R2_conditional = as.numeric(r2_obj$R2_conditional)
    )
  }, error = function(e) c(R2_marginal = NA_real_, R2_conditional = NA_real_))
  
  c(beta_star, eta_sq, r2_metrics)
}

obs_metrics <- extract_metrics_raw(base_model)
metric_names <- names(obs_metrics)

extract_metrics_safe <- function(fit, template_names = metric_names) {
  out <- setNames(rep(NA_real_, length(template_names)), template_names)
  raw <- tryCatch(extract_metrics_raw(fit), error = function(e) numeric(0))
  
  common <- intersect(names(raw), template_names)
  if (length(common) > 0) {
    out[common] <- as.numeric(raw[common])
  }
  out
}

# ==========================================
# 2. PERMUTATION HELPERS
# ==========================================

make_permuted_data <- function(
    base_df,
    participant_input_mapping,
    scheme = c("joint", "input_only", "slot_only"),
    input_levels,
    slot_levels,
    input_contrasts,
    slot_contrasts
) {
  scheme <- match.arg(scheme)
  
  perm_df <- base_df
  
  if (scheme %in% c("joint", "input_only")) {
    shuffled_mapping <- participant_input_mapping
    shuffled_mapping$Input_Method <- sample(shuffled_mapping$Input_Method)
    
    perm_df <- perm_df %>%
      dplyr::select(-Input_Method) %>%
      dplyr::left_join(shuffled_mapping, by = "Participant_ID")
  }
  
  perm_df <- perm_df %>%
    dplyr::mutate(
      Input_Method = factor(Input_Method, levels = input_levels),
      Slot_ID = factor(Slot_ID, levels = slot_levels)
    )
  
  if (scheme %in% c("joint", "slot_only")) {
    perm_df <- perm_df %>%
      dplyr::group_by(Participant_ID) %>%
      dplyr::mutate(
        Slot_ID = factor(sample(as.character(Slot_ID)), levels = slot_levels)
      ) %>%
      dplyr::ungroup()
  }
  
  contrasts(perm_df$Input_Method) <- input_contrasts
  contrasts(perm_df$Slot_ID) <- slot_contrasts
  
  perm_df
}

run_permutation_scheme <- function(
    scheme = c("joint", "input_only", "slot_only"),
    n_workers = 5,
    B_per_worker = 200,
    base_df,
    participant_input_mapping,
    metric_names,
    model_formula,
    input_levels,
    slot_levels,
    input_contrasts,
    slot_contrasts
) {
  scheme <- match.arg(scheme)
  
  cl <- parallel::makeCluster(n_workers)
  on.exit(parallel::stopCluster(cl), add = TRUE)
  doParallel::registerDoParallel(cl)
  
  seed_offset <- switch(
    scheme,
    joint = 101L,
    input_only = 202L,
    slot_only = 303L
  )
  parallel::clusterSetRNGStream(cl, 20260618 + seed_offset)
  
  perm_results_list <- foreach(
    w = seq_len(n_workers),
    .packages = c("lme4", "lmerTest", "effectsize", "performance", "dplyr"),
    .export = c(
      "make_permuted_data",
      "extract_metrics_safe",
      "extract_metrics_raw"
    )
  ) %dopar% {
    worker_reps <- matrix(
      NA_real_,
      nrow = B_per_worker,
      ncol = length(metric_names),
      dimnames = list(NULL, metric_names)
    )
    
    for (b in seq_len(B_per_worker)) {
      perm_df <- make_permuted_data(
        base_df = base_df,
        participant_input_mapping = participant_input_mapping,
        scheme = scheme,
        input_levels = input_levels,
        slot_levels = slot_levels,
        input_contrasts = input_contrasts,
        slot_contrasts = slot_contrasts
      )
      
      perm_model <- tryCatch(
        lme4::lmer(
          model_formula,
          data = perm_df,
          control = lme4::lmerControl(
            optimizer = "bobyqa",
            optCtrl = list(maxfun = 1e5)
          )
        ),
        error = function(e) NULL
      )
      
      if (!is.null(perm_model)) {
        worker_reps[b, ] <- extract_metrics_safe(perm_model, metric_names)
      }
    }
    
    as.data.frame(worker_reps)
  }
  
  do.call(dplyr::bind_rows, perm_results_list)
}

# ==========================================
# 3. RUN THREE PERMUTATION SCHEMES
# ==========================================

n_workers <- 5
B_per_worker <- 200

participant_input_mapping <- df %>%
  dplyr::select(Participant_ID, Input_Method) %>%
  dplyr::distinct()

input_levels <- levels(df$Input_Method)
slot_levels <- levels(df$Slot_ID)
input_contrasts <- contrasts(df$Input_Method)
slot_contrasts <- contrasts(df$Slot_ID)

joint_replicates_df <- run_permutation_scheme(
  scheme = "joint",
  n_workers = n_workers,
  B_per_worker = B_per_worker,
  base_df = df,
  participant_input_mapping = participant_input_mapping,
  metric_names = metric_names,
  model_formula = model_formula,
  input_levels = input_levels,
  slot_levels = slot_levels,
  input_contrasts = input_contrasts,
  slot_contrasts = slot_contrasts
)

input_replicates_df <- run_permutation_scheme(
  scheme = "input_only",
  n_workers = n_workers,
  B_per_worker = B_per_worker,
  base_df = df,
  participant_input_mapping = participant_input_mapping,
  metric_names = metric_names,
  model_formula = model_formula,
  input_levels = input_levels,
  slot_levels = slot_levels,
  input_contrasts = input_contrasts,
  slot_contrasts = slot_contrasts
)

slot_replicates_df <- run_permutation_scheme(
  scheme = "slot_only",
  n_workers = n_workers,
  B_per_worker = B_per_worker,
  base_df = df,
  participant_input_mapping = participant_input_mapping,
  metric_names = metric_names,
  model_formula = model_formula,
  input_levels = input_levels,
  slot_levels = slot_levels,
  input_contrasts = input_contrasts,
  slot_contrasts = slot_contrasts
)

joint_replicates_df <- joint_replicates_df %>%
  dplyr::select(dplyr::all_of(metric_names))

input_replicates_df <- input_replicates_df %>%
  dplyr::select(dplyr::all_of(metric_names))

slot_replicates_df <- slot_replicates_df %>%
  dplyr::select(dplyr::all_of(metric_names))

# ==========================================
# 4. PLOTTING SOURCE SELECTION
# ==========================================

choose_scheme_for_parameter <- function(parameter) {
  if (grepl("^R2_", parameter)) {
    return("joint")
  }
  
  if (grepl("^eta2_", parameter)) {
    term <- sub("^eta2_", "", parameter)
    
    if (grepl("Input_Method", term) && !grepl(":", term)) {
      return("input_only")
    }
    
    if (grepl("Slot_ID", term) && !grepl(":", term)) {
      return("slot_only")
    }
    
    if (grepl(":", term)) {
      return("joint")
    }
    
    return("joint")
  }
  
  if (grepl("Input_Method", parameter) && !grepl(":", parameter)) {
    return("input_only")
  }
  
  if (grepl("Slot_ID", parameter) && !grepl(":", parameter)) {
    return("slot_only")
  }
  
  if (grepl(":", parameter)) {
    return("joint")
  }
  
  return("joint")
}

build_long_replicates <- function(repl_df, scheme_name) {
  tidyr::pivot_longer(
    repl_df,
    cols = dplyr::everything(),
    names_to = "Parameter",
    values_to = "Estimate"
  ) %>%
    dplyr::filter(!is.na(Estimate)) %>%
    dplyr::mutate(
      Scheme = scheme_name,
      Variable_Group = stringr::str_replace_all(Parameter, "\\d+(?=:|$)", ""),
      Metric_Type = dplyr::case_when(
        stringr::str_detect(Parameter, "^R2") ~ "R2",
        stringr::str_detect(Parameter, "^eta2") ~ "eta2",
        TRUE ~ "beta"
      )
    )
}

scheme_map <- data.frame(
  Parameter = names(obs_metrics),
  Scheme = vapply(names(obs_metrics), choose_scheme_for_parameter, character(1)),
  stringsAsFactors = FALSE
)

plot_long_list <- list()

for (i in seq_len(nrow(scheme_map))) {
  p_name <- scheme_map$Parameter[i]
  sch <- scheme_map$Scheme[i]
  
  source_df <- switch(
    sch,
    joint = build_long_replicates(joint_replicates_df, "joint"),
    input_only = build_long_replicates(input_replicates_df, "input_only"),
    slot_only = build_long_replicates(slot_replicates_df, "slot_only")
  )
  
  plot_long_list[[i]] <- source_df %>%
    dplyr::filter(Parameter == p_name)
}

long_replicates <- dplyr::bind_rows(plot_long_list)

obs_df <- data.frame(
  Parameter = names(obs_metrics),
  Observed = as.numeric(obs_metrics),
  stringsAsFactors = FALSE
) %>%
  dplyr::mutate(
    Variable_Group = stringr::str_replace_all(Parameter, "\\d+(?=:|$)", ""),
    Metric_Type = dplyr::case_when(
      stringr::str_detect(Parameter, "^R2") ~ "R2",
      stringr::str_detect(Parameter, "^eta2") ~ "eta2",
      TRUE ~ "beta"
    )
  )

beta_data <- long_replicates %>% dplyr::filter(Metric_Type == "beta")
eta2_data <- long_replicates %>% dplyr::filter(Metric_Type == "eta2")
r2_data <- long_replicates %>% dplyr::filter(Metric_Type == "R2")

raw_beta_min <- if (nrow(beta_data) > 0) min(beta_data$Estimate, na.rm = TRUE) else NA_real_
raw_beta_max <- if (nrow(beta_data) > 0) max(beta_data$Estimate, na.rm = TRUE) else NA_real_

beta_obs_vals <- as.numeric(
  obs_metrics[names(obs_metrics) %in% beta_data$Parameter]
)
eta2_obs_vals <- as.numeric(
  obs_metrics[names(obs_metrics) %in% eta2_data$Parameter]
)
r2_obs_vals <- as.numeric(
  obs_metrics[names(obs_metrics) %in% r2_data$Parameter]
)

beta_plot_min <- min(c(raw_beta_min, -0.45, beta_obs_vals), na.rm = TRUE)
beta_plot_max <- max(c(raw_beta_max, 0.45, beta_obs_vals), na.rm = TRUE)

eta2_plot_max <- max(
  c(if (nrow(eta2_data) > 0) eta2_data$Estimate else NA_real_, 0.16, eta2_obs_vals),
  na.rm = TRUE
)

r2_plot_max <- max(
  c(if (nrow(r2_data) > 0) r2_data$Estimate else NA_real_, 0.28, r2_obs_vals),
  na.rm = TRUE
)

unique_groups <- unique(long_replicates$Variable_Group)
plot_list <- list()

# ==========================================
# 5. PLOTTING ITERATION LOOP
# ==========================================

for (group in unique_groups) {
  subset_data <- long_replicates %>% dplyr::filter(Variable_Group == group)
  metric <- unique(subset_data$Metric_Type)
  
  param_levels <- unique(subset_data$Parameter)
  extended_levels <- c(param_levels, "LABEL_GAP_PLACEHOLDER")
  subset_data$Parameter <- factor(subset_data$Parameter, levels = extended_levels)
  
  group_obs <- obs_df %>% dplyr::filter(Variable_Group == group)
  group_obs$Parameter <- factor(group_obs$Parameter, levels = extended_levels)
  
  p <- ggplot2::ggplot()
  
  if (metric == "beta") {
    rect_df <- data.frame(
      xmin = c(-Inf, -0.4, -0.3, -0.2, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3, 0.4),
      xmax = c(-0.4, -0.3, -0.2, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3, 0.4, Inf),
      fill_color = c("vlarge", "large", "mid", "small", "vsmall", "none", "vsmall", "small", "mid", "large", "vlarge"),
      label = c("Very Large", "Large", "Middle", "Small", "Very Small", "None", "Very Small", "Small", "Middle", "Large", "Very Large")
    )
    
    rect_df <- rect_df %>%
      dplyr::mutate(xmin = pmax(xmin, beta_plot_min), xmax = pmin(xmax, beta_plot_max)) %>%
      dplyr::filter(xmin < xmax)
    
    p <- p +
      ggplot2::geom_rect(
        data = rect_df,
        ggplot2::aes(xmin = xmin, xmax = xmax, ymin = -Inf, ymax = Inf, fill = fill_color),
        alpha = 0.15,
        inherit.aes = FALSE
      ) +
      ggplot2::scale_fill_manual(values = c("vlarge" = "red", "large" = "orange", "mid" = "yellow", "small" = "green", "vsmall" = "blue", "none" = "transparent")) +
      ggplot2::geom_vline(xintercept = 0, color = "black", linewidth = 1) +
      ggplot2::geom_text(
        data = rect_df,
        ggplot2::aes(x = (xmin + xmax) / 2, y = "LABEL_GAP_PLACEHOLDER", label = label),
        inherit.aes = FALSE,
        size = 3,
        fontface = "bold",
        vjust = 0.5
      ) +
      ggplot2::coord_cartesian(xlim = c(beta_plot_min, beta_plot_max), clip = "off")
    
  } else if (metric == "eta2") {
    rect_df <- data.frame(
      xmin = c(0, 0.01, 0.06, 0.14),
      xmax = c(0.01, 0.06, 0.14, Inf),
      fill_color = c("vsmall", "small", "mid", "large"),
      label = c("None", "Small", "Middle", "Large")
    )
    
    rect_df <- rect_df %>%
      dplyr::mutate(xmin = pmax(xmin, 0), xmax = pmin(xmax, eta2_plot_max)) %>%
      dplyr::filter(xmin < xmax)
    
    p <- p +
      ggplot2::geom_rect(
        data = rect_df,
        ggplot2::aes(xmin = xmin, xmax = xmax, ymin = -Inf, ymax = Inf, fill = fill_color),
        alpha = 0.15,
        inherit.aes = FALSE
      ) +
      ggplot2::scale_fill_manual(values = c("large" = "red", "mid" = "orange", "small" = "yellow", "vsmall" = "transparent")) +
      ggplot2::geom_text(
        data = rect_df,
        ggplot2::aes(x = (xmin + xmax) / 2, y = "LABEL_GAP_PLACEHOLDER", label = label),
        inherit.aes = FALSE,
        size = 3,
        fontface = "bold",
        vjust = 0.5
      ) +
      ggplot2::coord_cartesian(xlim = c(0, eta2_plot_max), clip = "off")
    
  } else if (metric == "R2") {
    rect_df <- data.frame(
      xmin = c(0, 0.02, 0.13, 0.26),
      xmax = c(0.02, 0.13, 0.26, Inf),
      fill_color = c("vsmall", "small", "mid", "large"),
      label = c("None", "Small", "Middle", "Large")
    )
    
    rect_df <- rect_df %>%
      dplyr::mutate(xmin = pmax(xmin, 0), xmax = pmin(xmax, r2_plot_max)) %>%
      dplyr::filter(xmin < xmax)
    
    p <- p +
      ggplot2::geom_rect(
        data = rect_df,
        ggplot2::aes(xmin = xmin, xmax = xmax, ymin = -Inf, ymax = Inf, fill = fill_color),
        alpha = 0.15,
        inherit.aes = FALSE
      ) +
      ggplot2::scale_fill_manual(values = c("large" = "red", "mid" = "orange", "small" = "yellow", "vsmall" = "transparent")) +
      ggplot2::geom_text(
        data = rect_df,
        ggplot2::aes(x = (xmin + xmax) / 2, y = "LABEL_GAP_PLACEHOLDER", label = label),
        inherit.aes = FALSE,
        size = 3,
        fontface = "bold",
        vjust = 0.5
      ) +
      ggplot2::coord_cartesian(xlim = c(0, r2_plot_max), clip = "off")
  }
  
  p <- p +
    ggridges::geom_density_ridges(
      data = subset_data,
      ggplot2::aes(x = Estimate, y = Parameter),
      fill = "gray40",
      alpha = 0.5,
      scale = 0.8,
      rel_min_height = 0.01,
      inherit.aes = FALSE
    ) +
    ggplot2::geom_segment(
      data = group_obs,
      ggplot2::aes(
        x = Observed,
        xend = Observed,
        y = as.numeric(Parameter) - 0.2,
        yend = as.numeric(Parameter) + 0.6
      ),
      color = "red",
      linewidth = 1.2,
      linetype = "dashed",
      inherit.aes = FALSE
    ) +
    ggplot2::scale_y_discrete(breaks = param_levels) +
    ggplot2::theme_minimal() +
    ggplot2::theme(
      legend.position = "none",
      plot.margin = ggplot2::margin(t = 20, r = 10, b = 10, l = 10)
    ) +
    ggplot2::labs(
      title = paste0(group, " (Null Distribution vs Observed Line)"),
      x = "Estimate",
      y = "Parameter"
    )
  
  print(p)
  plot_list[[group]] <- p
}

# ==========================================
# 6. P-VALUE REPORTING
# ==========================================

calculate_perm_p_value <- function(perm_dist, obs_val, two_sided = TRUE) {
  perm_dist <- perm_dist[is.finite(perm_dist)]
  
  if (length(perm_dist) == 0 || !is.finite(obs_val)) {
    return(NA_real_)
  }
  
  if (two_sided) {
    exceed_count <- sum(abs(perm_dist) >= abs(obs_val))
  } else {
    exceed_count <- sum(perm_dist >= obs_val)
  }
  
  (exceed_count + 1) / (length(perm_dist) + 1)
}

get_perm_source <- function(parameter) {
  scheme <- choose_scheme_for_parameter(parameter)
  
  switch(
    scheme,
    joint = joint_replicates_df,
    input_only = input_replicates_df,
    slot_only = slot_replicates_df
  )
}

p_values <- numeric(length(obs_metrics))
names(p_values) <- names(obs_metrics)

for (p_name in names(obs_metrics)) {
  is_beta <- !grepl("^(eta2_|R2_)", p_name)
  perm_source <- get_perm_source(p_name)
  
  p_values[p_name] <- calculate_perm_p_value(
    perm_dist = perm_source[[p_name]],
    obs_val = obs_metrics[p_name],
    two_sided = is_beta
  )
}

global_p_marginal <- calculate_perm_p_value(
  perm_dist = joint_replicates_df$R2_marginal,
  obs_val = obs_metrics["R2_marginal"],
  two_sided = FALSE
)

global_p_conditional <- calculate_perm_p_value(
  perm_dist = joint_replicates_df$R2_conditional,
  obs_val = obs_metrics["R2_conditional"],
  two_sided = FALSE
)

scheme_report <- data.frame(
  Parameter = names(obs_metrics),
  Permutation_Scheme = vapply(names(obs_metrics), choose_scheme_for_parameter, character(1)),
  stringsAsFactors = FALSE
)

print("--- Observed Statistics")
print(obs_metrics)

print("--- Permutation Scheme Map")
print(scheme_report)

print("--- Permutation P-values")
print(p_values)

print("--- Overall R2 P-values (joint permutation)")
print(
  c(
    R2_marginal = global_p_marginal,
    R2_conditional = global_p_conditional
  )
)