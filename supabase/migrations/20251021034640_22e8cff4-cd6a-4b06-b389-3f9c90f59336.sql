-- Enable realtime for bets table so the UI updates automatically
ALTER TABLE bets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE bets;