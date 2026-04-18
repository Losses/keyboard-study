random_dist <- function(
  smash, 
  xmin = 0, xmax = 10, 
  ymin = 0, ymax = 10, 
  N = 10000
) {
  char_codes <- utf8ToInt(smash)
  seed_val <- 0
  for (code in char_codes) {
    seed_val <- (seed_val * 31 + code) %% 2147483647L
  }
  set.seed(as.integer(seed_val))

  num_modes <- sample(3:9, 1)

  xmeans <- runif(num_modes, xmin, xmax)
  ymeans <- runif(num_modes, ymin, ymax)

  scales_x <- runif(num_modes, (xmax - xmin)/25, (xmax - xmin)/4)
  scales_y <- runif(num_modes, (ymax - ymin)/25, (ymax - ymin)/4)

  rhos <- runif(num_modes, -0.85, 0.85)

  weights <- rexp(num_modes)
  weights <- weights / sum(weights)

  components <- sample(1:num_modes, N, replace = TRUE, prob = weights)
  
  xs <- numeric(N)
  ys <- numeric(N)

  for (k in 1:num_modes) {
    idx <- components == k
    nk <- sum(idx)
    if (nk == 0) next

    if (runif(1) < 0.4) {
      xs[idx] <- runif(nk, 
                       xmeans[k] - scales_x[k], 
                       xmeans[k] + scales_x[k])
      ys[idx] <- runif(nk, 
                       ymeans[k] - scales_y[k], 
                       ymeans[k] + scales_y[k])
    } else {
      covmat <- matrix(c(scales_x[k]^2, rhos[k]*scales_x[k]*scales_y[k],
                         rhos[k]*scales_x[k]*scales_y[k], scales_y[k]^2), 
                       nrow = 2)
      Z <- matrix(rnorm(nk * 2), nrow = nk, ncol = 2)
      U <- chol(covmat)
      scaled <- Z %*% U
      xs[idx] <- xmeans[k] + scaled[, 1]
      ys[idx] <- ymeans[k] + scaled[, 2]
    }
  }

  pmax(pmin(xs, xmax), xmin)
}

# ====================== 使用示例 ======================
# 脸滚键盘随便敲一串（越乱越好）
my_smash <- "coconut"

d <- random_dist(
  my_smash, 
  xmin = 0, xmax = 100, 
  ymin = -50, ymax = 50, 
  N = 20000
)

library(ggplot2)

ggplot(data.frame(x = d), aes(x = x)) + geom_density()

