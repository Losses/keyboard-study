random_dist <- function(
    smash,
    xmin = 0, xmax = 10,
    N = 10000
) {
  char_codes <- utf8ToInt(smash)
  seed_val <- 0
  for (code in char_codes) {
    seed_val <- (seed_val * 31 + code) %% 2147483647L
  }
  set.seed(as.integer(seed_val))
  
  num_modes <- sample(3:9, 1)
  xmeans  <- runif(num_modes, xmin, xmax)
  scales_x <- runif(num_modes, (xmax - xmin)/25, (xmax - xmin)/4)
  weights  <- rexp(num_modes); weights <- weights / sum(weights)
  
  components <- sample(1:num_modes, N, replace = TRUE, prob = weights)
  xs <- numeric(N)
  
  for (k in 1:num_modes) {
    idx <- components == k
    nk  <- sum(idx)
    if (nk == 0) next
    
    if (runif(1) < 0.4) {
      xs[idx] <- runif(nk, xmeans[k] - scales_x[k], xmeans[k] + scales_x[k])
    } else {
      xs[idx] <- rnorm(nk, mean = xmeans[k], sd = scales_x[k])
    }
  }
  
  pmax(pmin(xs, xmax), xmin)
}
