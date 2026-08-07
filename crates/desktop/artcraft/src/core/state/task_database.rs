use crate::core::state::data_dir::app_data_root::AppDataRoot;
use errors::AnyhowResult;
use sqlite_tasks::connection::TaskDbConnection;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct TaskDatabase {
  connection: TaskDbConnection,
  db_path: PathBuf,
}

impl TaskDatabase {
  pub async fn connect(root: &AppDataRoot) -> AnyhowResult<Self> {
    let path = root.state_dir().get_tasks_sqlite_database_path();
    let connection = TaskDbConnection::connect_and_migrate(&path).await?;
    Ok(Self { connection, db_path: path })
  }

  pub fn get_connection(&self) -> &TaskDbConnection {
    &self.connection
  }

  /// Absolute path of the SQLite file backing this database. All Floword
  /// commands and the pipeline worker share a single managed `TaskDatabase`
  /// instance, so this path is identical everywhere — logged to make that
  /// invariant observable when diagnosing "workflow not found".
  pub fn db_path(&self) -> &Path {
    &self.db_path
  }

  /// Lossy string form of [`db_path`](Self::db_path) for logging.
  pub fn db_path_display(&self) -> String {
    self.db_path.to_string_lossy().to_string()
  }
}
