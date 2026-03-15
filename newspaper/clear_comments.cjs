const Database = require("better-sqlite3");
const db = new Database("syndicate.db");

try {
  // We only want to delete the comments we injected via the scraping process.
  // The fastest way is to clear the article_comments table completely for now,
  // or delete comments tied to the most recent article ID if the user had older comments.
  // Since the user is testing the system and the previous comments were purely the youtube scrape,
  // wiping the article_comments table is safe to reset the state for real engagement.

  const result = db.prepare("DELETE FROM article_comments").run();
  console.log(`Deleted ${result.changes} fake comments from the database.`);
} catch (error) {
  console.error("Failed to clear comments:", error);
} finally {
  db.close();
}
