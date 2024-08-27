import rateLimit from "express-rate-limit";

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limite à 5 requêtes par minute
  message: "Trop de requêtes, veuillez réessayer plus tard.",
});
