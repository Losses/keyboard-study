source("https://kb.not.ci/rand-dist.R")

library(tidyverse)
library(plotly)
library(parallel)
library(pbapply)

population <- random_dist(
  "playnow",
  xmin = 0, xmax = 100,
  N = 200000
)

n_simulations <- 20000
reps <- 1
n_values <- seq(1, 2000, by = 1)

generate_for_n <- function(n) {
  results <- vector("list", reps)
  
  for (r in seq_len(reps)) {
    samples <- matrix(
      sample(population, n * n_simulations, replace = TRUE),
      nrow = n_simulations,
      ncol = n
    )
    
    results[[r]] <- data.frame(
      x = rowMeans(samples),
      n_per_sample = n,
      rep = r,
      frame_id = (n - 1L) * reps + r
    )
  }
  
  do.call(rbind, results)
}

n_cores <- max(1L, detectCores() - 1L)
cl <- makeCluster(n_cores)
clusterExport(cl, c("population", "n_simulations", "reps"))

df_all <- pblapply(n_values, generate_for_n, cl = cl) |>
  do.call(rbind, args = _)

stopCluster(cl)

pb <- txtProgressBar(max = length(unique(df_all$frame_id)), style = 3)

density_data <- df_all |>
  group_by(frame_id, n_per_sample) |>
  group_modify(~ {
    setTxtProgressBar(pb, .y$frame_id[1])
    d <- density(.x$x, n = 70)
    data.frame(
      x = round(d$x, 3),
      y = round(d$y, 6)
    )
  }) |>
  ungroup()

close(pb)

max_y <- max(density_data$y) * 1.08
x_grid <- seq(min(density_data$x), max(density_data$x), length.out = 200)

surface_data <- density_data |>
  arrange(n_per_sample, x) |>
  group_by(n_per_sample) |>
  summarise(
    z = list(approx(x, y, xout = x_grid, rule = 2)$y),
    .groups = "drop"
  )

z_matrix <- do.call(rbind, surface_data$z)

fig <- density_data |>
  plot_ly(
    x = ~x,
    y = ~y,
    frame = ~frame_id,
    type = 'scatter',
    mode = 'lines',
    line = list(shape = 'spline')
  ) |>
  add_trace(
    x = x_grid,
    y = surface_data$n_per_sample,
    z = z_matrix,
    type = 'surface',
    visible = FALSE,
    inherit = FALSE,
    showlegend = FALSE,
    showscale = FALSE,
    colorscale = 'Viridis',
    contours = list(
      z = list(
        show = TRUE,
        usecolormap = TRUE,
        highlightcolor = "#444",
        project = list(z = TRUE)
      )
    )
  ) |>
  layout(
    xaxis = list(title = "Sample Mean", range = c(0, 100)),
    yaxis = list(title = "Density", range = c(0, max_y)),
    scene = list(
      xaxis = list(title = "Sample Mean", visible = FALSE, range = c(0, 100)),
      yaxis = list(title = "Sample Size", visible = FALSE, range = c(1, 2000)),
      zaxis = list(title = "Density", visible = FALSE, range = c(0, max_y)),
      camera = list(
        eye = list(x = 1.6, y = -1.5, z = 0.9)
      ),
      aspectmode = "manual",
      aspectratio = list(x = 1.5, y = 1.2, z = 0.9)
    )
  ) |>
  animation_opts(
    frame = 50,
    transition = 50,
    redraw = FALSE
  ) |>
  animation_slider(
    currentvalue = list(
      prefix = "N = ", 
      font = list(size = 16, color = "black")
    )
  ) |>
  animation_button()

fig$x$layout$updatemenus <- c(
  fig$x$layout$updatemenus,
  list(
    list(
      type = "buttons",
      active = -1,
      x = 0,
      xanchor = "left",
      y = 1.12,
      yanchor = "top",
      buttons = list(
        list(
          label = "3D / 2D",
          method = "update",
          args = list(
            list(visible = c(FALSE, TRUE)),
            list(
              xaxis = list(title = "Sample Mean", visible = FALSE, range = c(0, 100)),
              yaxis = list(title = "Density", visible = FALSE, range = c(0, max_y)),
              scene = list(
                xaxis = list(title = "Sample Mean", visible = TRUE, range = c(0, 100)),
                yaxis = list(title = "Sample Size", visible = TRUE, range = c(1, 2000)),
                zaxis = list(title = "Density", visible = TRUE, range = c(0, max_y)),
                camera = list(
                  eye = list(x = 1.6, y = -1.5, z = 0.9)
                ),
                aspectmode = "manual",
                aspectratio = list(x = 1.5, y = 1.2, z = 0.9)
              )
            )
          ),
          args2 = list(
            list(visible = c(TRUE, FALSE)),
            list(
              xaxis = list(title = "Sample Mean", visible = TRUE, range = c(0, 100)),
              yaxis = list(title = "Density", visible = TRUE, range = c(0, max_y)),
              scene = list(
                xaxis = list(title = "Sample Mean", visible = FALSE, range = c(0, 100)),
                yaxis = list(title = "Sample Size", visible = FALSE, range = c(1, 2000)),
                zaxis = list(title = "Density", visible = FALSE, range = c(0, max_y)),
                camera = list(
                  eye = list(x = 1.6, y = -1.5, z = 0.9)
                ),
                aspectmode = "manual",
                aspectratio = list(x = 1.5, y = 1.2, z = 0.9)
              )
            )
          )
        )
      )
    )
  )
)

htmlwidgets::saveWidget(fig, "animation.html", selfcontained = FALSE)
