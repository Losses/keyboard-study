library(lme4)
library(lmerTest)
library(afex)
library(effectsize)
library(parameters)
library(lmeresampler)
library(lqmm)
library(robustlmm)
library(doParallel)
library(foreach)
library(ggplot2)
library(tidyr)
library(dplyr)
library(stringr)
library(ggridges)
library(performance)

# ==========================================
# 1. DATA PREPARATION & MODEL FITTING
# ==========================================

df <- read.csv("./lv2.csv")

df$Input_Method <- factor(df$Input_Method)
df$Slot_ID <- factor(df$Slot_ID)

contrasts(df$Input_Method) <- contr.helmert(levels(df$Input_Method))
contrasts(df$Slot_ID)      <- contr.sum(levels(df$Slot_ID))

z_score <- function(x) {
  z <- scale(x)
  list(values = as.numeric(z), center = attr(z, "center")[1], scale = attr(z, "scale")[1])
}

ww_z <- z_score(df$Window_Width_mm)
cs_z <- z_score(df$Chars_On_Screen)
iv_z <- z_score(df$Interval_ms)

df$Window_Width_mm_z <- ww_z$values
df$Chars_On_Screen_z <- cs_z$values
df$Interval_ms_z      <- iv_z$values

scaling_info <- list(
  Window_Width_mm = list(center = ww_z$center, scale = ww_z$scale),
  Chars_On_Screen = list(center = cs_z$center, scale = cs_z$scale),
  Interval_ms      = list(center = iv_z$center, scale = iv_z$scale)
)

base_model <- lme4::lmer(
  Interval_ms_z ~ Input_Method * Slot_ID + Window_Width_mm_z + Chars_On_Screen_z + (1 | Participant_ID / Trial_ID),
  data = df,
  control = lmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 1e5))
)

extract_metrics <- function(fit) {
  beta_star <- lme4::fixef(fit)
  
  fit_lmertest <- lmerTest::as_lmerModLmerTest(fit)
  eta_obj <- effectsize::eta_squared(fit_lmertest, partial = TRUE)
  eta_sq <- eta_obj$Eta2_partial
  names(eta_sq) <- paste0("eta2_", eta_obj$Parameter)
  
  r2_obj <- performance::r2(fit)
  r2_metrics <- c(R2_marginal = r2_obj$R2_marginal, R2_conditional = r2_obj$R2_conditional)
  
  c(beta_star, eta_sq, r2_metrics)
}

# ==========================================
# 2. PARALLEL BOOTSTRAP COMPUTATION
# ==========================================

n_workers <- 10
B_per_worker <- 200

cl <- makeCluster(n_workers)
registerDoParallel(cl)

# Give every worker its own independent random-number stream. Without this,
# parallel workers are not guaranteed to draw independent bootstrap samples.
parallel::clusterSetRNGStream(cl, 20260618)

boot_results <- foreach(
  w = 1:n_workers,
  .packages = c("lme4", "lmerTest", "lmeresampler", "effectsize", "performance"),
  .export = c("base_model", "extract_metrics"),
  .combine = lmeresampler::combine_lmeresamp
) %dopar% {
  # base_model is fit once outside the parallel block and shared across
  # workers; each worker only runs its own share of the bootstrap replicates.
  lmeresampler::bootstrap(
    base_model,
    .f = extract_metrics,
    type = "parametric",
    B = B_per_worker
  )
}

stopCluster(cl)

# ==========================================
# 3. DATA REFACTORING & POST-PROCESSING
# ==========================================

replicates_df <- as.data.frame(boot_results$replicates)

long_replicates <- tidyr::pivot_longer(
  replicates_df,
  cols = dplyr::everything(),
  names_to = "Parameter",
  values_to = "Estimate"
)

long_replicates <- long_replicates %>%
  dplyr::mutate(
    Variable_Group = stringr::str_replace_all(Parameter, "\\d+(?=:|$)", ""),
    Metric_Type = dplyr::case_when(
      stringr::str_detect(Parameter, "^R2") ~ "R2",
      stringr::str_detect(Parameter, "^eta2") ~ "eta2",
      TRUE ~ "beta"
    )
  )

beta_data <- long_replicates %>% dplyr::filter(Metric_Type == "beta")
raw_beta_min <- min(beta_data$Estimate, na.rm = TRUE)
raw_beta_max <- max(beta_data$Estimate, na.rm = TRUE)
beta_plot_min <- min(raw_beta_min, -0.45)
beta_plot_max <- max(raw_beta_max, 0.45)

eta2_data <- long_replicates %>% dplyr::filter(Metric_Type == "eta2")
eta2_plot_max <- max(eta2_data$Estimate, 0.16, na.rm = TRUE)

r2_data <- long_replicates %>% dplyr::filter(Metric_Type == "R2")
r2_plot_max <- max(r2_data$Estimate, 0.28, na.rm = TRUE)

unique_groups <- unique(long_replicates$Variable_Group)
plot_list <- list()

# ==========================================
# 4. PLOTTING ITERATION LOOP
# ==========================================

for (group in unique_groups) {
  subset_data <- long_replicates %>% dplyr::filter(Variable_Group == group)
  metric <- unique(subset_data$Metric_Type)
  
  param_levels <- unique(subset_data$Parameter)
  
  extended_levels <- c(param_levels, "LABEL_GAP_PLACEHOLDER")
  subset_data$Parameter <- factor(subset_data$Parameter, levels = extended_levels)
  
  p <- ggplot2::ggplot()
  
  if (metric == "beta") {
    rect_df <- data.frame(
      xmin = c(-Inf, -0.4, -0.3, -0.2, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3, 0.4),
      xmax = c(-0.4, -0.3, -0.2, -0.1, -0.05,  0.05, 0.1, 0.2, 0.3, 0.4, Inf),
      fill_color = c("vlarge", "large", "mid", "small", "vsmall", "none", "vsmall", "small", "mid", "large", "vlarge"),
      label = c("Very Large", "Large", "Middle", "Small", "Very Small", "None", "Very Small", "Small", "Middle", "Large", "Very Large")
    )
    
    rect_df <- rect_df %>%
      dplyr::mutate(xmin = pmax(xmin, beta_plot_min), xmax = pmin(xmax, beta_plot_max)) %>%
      dplyr::filter(xmin < xmax)
    
    p <- p +
      ggplot2::geom_rect(data = rect_df, aes(xmin = xmin, xmax = xmax, ymin = -Inf, ymax = Inf, fill = fill_color),
                         alpha = 0.15, inherit.aes = FALSE) +
      ggplot2::scale_fill_manual(values = c("vlarge" = "red", "large" = "orange", "mid" = "yellow", "small" = "green", "vsmall" = "blue", "none" = "transparent")) +
      ggplot2::geom_vline(xintercept = 0, color = "black", linewidth = 1) +
      ggplot2::geom_text(data = rect_df, aes(x = (xmin + xmax) / 2, y = "LABEL_GAP_PLACEHOLDER", label = label),
                         inherit.aes = FALSE, size = 3, fontface = "bold", vjust = 0.5) +
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
      ggplot2::geom_rect(data = rect_df, aes(xmin = xmin, xmax = xmax, ymin = -Inf, ymax = Inf, fill = fill_color),
                         alpha = 0.15, inherit.aes = FALSE) +
      ggplot2::scale_fill_manual(values = c("large" = "red", "mid" = "orange", "small" = "yellow", "vsmall" = "transparent")) +
      ggplot2::geom_text(data = rect_df, aes(x = (xmin + xmax) / 2, y = "LABEL_GAP_PLACEHOLDER", label = label),
                         inherit.aes = FALSE, size = 3, fontface = "bold", vjust = 0.5) +
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
      ggplot2::geom_rect(data = rect_df, aes(xmin = xmin, xmax = xmax, ymin = -Inf, ymax = Inf, fill = fill_color),
                         alpha = 0.15, inherit.aes = FALSE) +
      ggplot2::scale_fill_manual(values = c("large" = "red", "mid" = "orange", "small" = "yellow", "vsmall" = "transparent")) +
      ggplot2::geom_text(data = rect_df, aes(x = (xmin + xmax) / 2, y = "LABEL_GAP_PLACEHOLDER", label = label),
                         inherit.aes = FALSE, size = 3, fontface = "bold", vjust = 0.5) +
      ggplot2::coord_cartesian(xlim = c(0, r2_plot_max), clip = "off")
  }
  
  p <- p +
    ggridges::geom_density_ridges(data = subset_data, aes(x = Estimate, y = Parameter),
                                  fill = "gray40", alpha = 0.5, scale = 0.8, rel_min_height = 0.01, inherit.aes = FALSE) +
    ggplot2::scale_y_discrete(breaks = param_levels) +
    ggplot2::theme_minimal() +
    ggplot2::theme(
      legend.position = "none",
      plot.margin = margin(t = 20, r = 10, b = 10, l = 10)
    ) +
    ggplot2::labs(title = group, x = "Estimate", y = "Parameter")
  
  print(p)
  plot_list[[group]] <- p
}

# ==========================================
# 5. P-VALUE & CONFIDENCE INTERVAL REPORTING
# ==========================================

calculate_p_value <- function(boot_distribution) {
  2 * min(mean(boot_distribution > 0), mean(boot_distribution < 0))
}

is_beta_col <- !grepl("^(eta2_|R2_)", colnames(replicates_df))

beta_p_values <- vapply(replicates_df[, is_beta_col, drop = FALSE], calculate_p_value, numeric(1))

effect_size_ci <- t(sapply(replicates_df[, !is_beta_col, drop = FALSE], function(x) {
  quantile(x, probs = c(0.025, 0.975), na.rm = TRUE)
}))
colnames(effect_size_ci) <- c("CI_2.5%", "CI_97.5%")

print(beta_p_values)
print(effect_size_ci)