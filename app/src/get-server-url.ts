/**
 * This method return the server URL based on the deployment environment.
 */

export function getServerUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  //If we are in production, we return the production URL
  if (process.env.VERCEL_ENV === "production") {
    return "get-task-trek.vercel.app";
  }

  //If we are in "stage" environment, we return the staging URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  //If we are in development, we return the localhost URL
  return "http://localhost:3000";
}
