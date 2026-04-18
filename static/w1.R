library(tidyverse)
library(DescTools)

data <- read.csv("./data.csv")

data <- data[data$Time_ms < 3000, ]

summary(data$Time_ms)
Mode(data$Time_ms)

candidates <- seq(0, 5000, by = 0.10)

l0 <- function(x) sum(abs(x - data$Time_ms) > 1)
l1 <- function(x) mean(abs(x - data$Time_ms))
l2 <- function(x) mean((x - data$Time_ms)^2)

err_count <- vapply(candidates, l0, 1);
err_abs <- vapply(candidates, l1, 1);
err_sqrt <- vapply(candidates, l2, 1);

estimate_df <- data.frame(
  candidate = candidates,
  err_count = err_count,
  err_abs = err_abs,
  err_sqrt = err_sqrt
)

normalize <- function(x) (x - mean(x)) / (max(x) - min(x))

# We perform a normalization to ensure that the plot does not become distorted.
estimate_df$err_count_normalized <- estimate_df$err_count %>% normalize
estimate_df$err_abs_normalized <- estimate_df$err_abs %>% normalize
estimate_df$err_sqrt_normalized <- estimate_df$err_sqrt %>% normalize

estimate_df[estimate_df$err_count_normalized == min(estimate_df$err_count_normalized), "candidate"]
estimate_df[estimate_df$err_abs_normalized == min(estimate_df$err_abs_normalized), "candidate"]
estimate_df[estimate_df$err_sqrt_normalized == min(estimate_df$err_sqrt_normalized), "candidate"]

ggplot(estimate_df, aes(x = candidate)) +
  geom_line(aes(y = err_count_normalized), color = "green") +
  geom_line(aes(y = err_abs_normalized), color = "red") +
  geom_line(aes(y = err_sqrt_normalized), color = "blue") +
  geom_point(
    aes(
      y = min(estimate_df$err_count_normalized),
      x = estimate_df[estimate_df$err_count_normalized == min(estimate_df$err_count_normalized), "candidate"],
    ),
    colour = "darkgreen"
  ) +
  geom_point(
    aes(
      y = min(estimate_df$err_abs_normalized),
      x = estimate_df[estimate_df$err_abs_normalized == min(estimate_df$err_abs_normalized), "candidate"],
    ),
    colour = "darkred"
  ) +
  geom_point(
    aes(
      y = min(estimate_df$err_sqrt_normalized),
      x = estimate_df[estimate_df$err_sqrt_normalized == min(estimate_df$err_sqrt_normalized), "candidate"],
    ),
    colour = "darkblue"
  ) +
  labs(y = "E(err)")

