library(pbapply)
library(parallel)
library(ggthemes)
library(magrittr)
library(tidyverse)

set.seed(2333)

cl <- makeCluster(detectCores())

DIST = list(
  "Normal" = rnorm(1e6, 22.58, 4.41),
  "Multimodal" = c(
    rnorm(1e6/4*2, 22.58, 4.41),
    rnorm(1e6/4, 10, 2),
    rnorm(1e6/4, 35.16, 2)
  ),
  "Uniform" = runif(1e6, 9.35, 35.81),
  "Discrete" = c(
    runif(1e6/2, 0.35, 5.35),
    runif(1e6/2, 39.81, 44.81)
  ), 
  "Skewed" = rchisq(1e6, 3) * (22.58/3)
)

lapply(DIST, mean)

SMP_SIZE <- c(1, 3, 5, 8, 10, 20, 30, 50, 100, 200, 2000, 5000)

clusterExport(cl, 'DIST')

simulated_data <- pblapply(SMP_SIZE, function(smp_size) {
  library(tidyverse)
  
  lapply(names(DIST), function(dist_idx) {
    lapply(1:1e5, function(.x) {
      smp <- sample(DIST[[dist_idx]], smp_size)
      
      tibble(
        label = paste0(dist_idx, " n=", as.character(smp_size)),
        dist = dist_idx,
        data = mean(smp),
        sam_size = as.character(smp_size)
      )
    }) %>% bind_rows
  }) %>% bind_rows
}, cl = cl) %>% bind_rows

plot_data <- bind_rows(
  tibble(
    label = paste0(rep(names(DIST), each = 1e6), " pop."),
    sam_size = 'population',
    data = unlist(DIST),
    dist = rep(names(DIST), each = 1e6)
  ), 
  simulated_data
)

plot_data$label %<>% factor(., levels = unique(.))

ggplot(plot_data, aes(data, color = dist, fill = dist)) + 
  geom_density(adjust = 1/5, alpha = 0.5) + 
  #geom_histogram(bins = 20) +
  facet_wrap( ~ label, scales = 'free', ncol = 5) +
  theme_wsj() +
  theme(
    axis.title=element_blank(),
    axis.text.y=element_blank(),
    axis.ticks.y=element_blank(),
    axis.text.x = element_text(size = 8),
    legend.position = 'none',
    title = element_text(size = 16),
  ) + 
  labs(
    title = paste0('Sample Distribution of ', 'mean'),
    subtitle = 'Quant UX Workshop - Week 3',
    caption = 'Distribution Demo Script'
  )
