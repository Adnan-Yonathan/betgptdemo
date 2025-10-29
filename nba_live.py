"""Utility functions for fetching live NBA data using nba_api.

This module exposes two primary helpers:

* :func:`get_live_scores` – Fetches today's NBA scoreboard and returns a JSON
  serialisable dictionary with details about each game.
* :func:`get_player_career_stats` – Optionally fetches a player's career
  averages using the stats endpoint (requires a valid player ID).

Both functions are designed to be imported elsewhere in the application, while
still providing a convenient CLI sample output when executed directly.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from nba_api.live.nba.endpoints import scoreboard
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.library.http import NBAStatsHTTPException
from requests import RequestException


def get_live_scores() -> Dict[str, Any]:
    """Fetch today's NBA games and return their current status.

    Returns
    -------
    dict
        A dictionary with a ``games`` key that contains a list of game details
        (home/away teams, score, status). This structure is JSON serialisable
        and suitable for returning from an API endpoint or logging.

    Raises
    ------
    RuntimeError
        If the scoreboard data cannot be retrieved due to a network or
        rate-limit error.
    """

    try:
        board = scoreboard.ScoreBoard()
        board_data = board.get_dict()
        games_payload = board_data.get("scoreboard", {}).get("games", [])
        games: List[Dict[str, Any]] = []

        for game in games_payload:
            home_team = game.get("homeTeam", {})
            away_team = game.get("awayTeam", {})
            home_team_name = home_team.get("teamTricode", "N/A")
            away_team_name = away_team.get("teamTricode", "N/A")

            home_score = home_team.get("score", "0")
            away_score = away_team.get("score", "0")

            game_status_text = game.get("gameStatusText", "Unknown")

            games.append(
                {
                    "gameId": game.get("gameId"),
                    "homeTeam": home_team_name,
                    "awayTeam": away_team_name,
                    "homeScore": home_score,
                    "awayScore": away_score,
                    "status": game_status_text,
                }
            )

        return {"games": games}
    except (RequestException, NBAStatsHTTPException) as exc:
        raise RuntimeError("Failed to fetch live NBA scores") from exc


def get_player_career_stats(player_id: int) -> Dict[str, float]:
    """Fetch a player's career averages using the NBA stats API.

    Parameters
    ----------
    player_id : int
        The unique identifier used by the NBA stats API for the player.

    Returns
    -------
    dict
        A dictionary containing the player's career averages for points,
        assists, and rebounds per game.
    """

    try:
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        career_data = career.get_data_frames()[0]
    except (RequestException, NBAStatsHTTPException) as exc:
        raise RuntimeError("Failed to fetch player career stats") from exc

    if career_data.empty:
        return {"ppg": 0.0, "apg": 0.0, "rpg": 0.0}

    career_row = career_data.loc[career_data["SEASON_ID"] == "Career"]
    if career_row.empty:
        career_row = career_data.tail(1)

    totals = career_row.iloc[0]
    games_played = float(totals.get("GP", 0.0))

    if games_played <= 0:
        return {"ppg": 0.0, "apg": 0.0, "rpg": 0.0}

    return {
        "ppg": float(totals.get("PTS", 0.0)) / games_played,
        "apg": float(totals.get("AST", 0.0)) / games_played,
        "rpg": float(totals.get("REB", 0.0)) / games_played,
    }


def _print_sample_output() -> None:
    """Print sample live scores to the console."""

    try:
        live_scores = get_live_scores()
    except RuntimeError as exc:  # pragma: no cover - purely informational output
        print(exc)
        return

    games = live_scores.get("games", [])
    if not games:
        print("No NBA games scheduled for today.")
        return

    for game in games:
        away = game.get("awayTeam", "Unknown")
        home = game.get("homeTeam", "Unknown")
        away_score = game.get("awayScore", "0")
        home_score = game.get("homeScore", "0")
        status = game.get("status", "Unknown")
        print(f"{away} at {home} — {away_score}-{home_score} ({status})")


if __name__ == "__main__":
    sample_output = get_live_scores()
    print(json.dumps(sample_output, indent=2))
    print("\nFormatted output:")
    _print_sample_output()
