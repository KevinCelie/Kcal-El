CREATE TABLE IF NOT EXISTS goal_history (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  goal INTEGER NOT NULL CHECK (goal > 0),
  PRIMARY KEY (user_id, from_date)
);
