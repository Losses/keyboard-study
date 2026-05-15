lapply(1:1000, function(i) {
  n <- 1000
  a <- runif(n)
  b <- runif(n)
  mystery <- cor(a, b) * sqrt(var(a)) * sqrt(var(b))

  data.frame(
    all_eq = all.equal(mystery, cov(a, b)),
    direct_eq = (mystery == cov(a, b))
  )
}) |> do.call(rbind, args = _) |> summary(object = _)
