"""Utility functions for fetching NBA data using ``nba_api``.

This module exposes reusable helpers for working with NBA statistics via the
``nba_api`` package:

* :func:`get_live_scores` – Fetch today's NBA scoreboard and return a
  JSON-serialisable dictionary with details about each game.
* :func:`get_team_statistics` – Retrieve season aggregates for a given team
  (wins, losses, averages, etc.).
* :func:`get_player_statistics` – Retrieve per-mode statistics for a specific
  player (points, rebounds, assists, and more).
* :func:`get_player_career_stats` – Fetch a player's career averages and
  gracefully handle missing data.
* :func:`get_player_prop_recommendations` – Surface high-level blended prop
  scores to power betting-style queries when no explicit identifiers exist.

The helpers are designed to be imported elsewhere in the application while also
supporting basic command-line usage for manual inspection and lightweight
natural-language interpretation.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from typing import Any, Dict, Mapping, Optional

from nba_api.live.nba.endpoints import scoreboard
from nba_api.stats.endpoints import (
    leaguedashplayerstats,
    playercareerstats,
    playerdashboardbygeneralsplits,
    teamdashboardbygeneralsplits,
)
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
        games: list[Dict[str, Any]] = []

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


def get_team_statistics(
    team_id: int,
    *,
    season: Optional[str] = None,
    per_mode: str = "PerGame",
) -> Dict[str, Any]:
    """Return aggregate statistics for a given team.

    Parameters
    ----------
    team_id : int
        The NBA team ID to retrieve statistics for.
    season : str, optional
        The season string (e.g. ``"2023-24"``). Defaults to the current season
        based on today's date.
    per_mode : str, optional
        The stat aggregation mode supported by ``nba_api`` (``"PerGame"``,
        ``"Totals"``, etc.). Defaults to ``"PerGame"`` for easy consumption.

    Returns
    -------
    dict
        A dictionary containing the requested team's aggregate statistics.
    """

    target_season = season or _current_season()

    try:
        dashboard = teamdashboardbygeneralsplits.TeamDashboardByGeneralSplits(
            team_id=team_id,
            season=target_season,
            per_mode_detailed=per_mode,
        )
        data = dashboard.get_normalized_dict()
    except (RequestException, NBAStatsHTTPException) as exc:
        raise RuntimeError("Failed to fetch team statistics") from exc

    team_dashboard = data.get("overallTeamDashboard", [])
    if not team_dashboard:
        return {
            "teamId": team_id,
            "season": target_season,
            "perMode": per_mode,
            "gamesPlayed": 0,
            "averages": {},
        }

    row = team_dashboard[0]
    averages = _extract_fields(
        row,
        {
            "wins": ("W", int, 0),
            "losses": ("L", int, 0),
            "winPct": ("W_PCT", float, 0.0),
            "points": ("PTS", float, 0.0),
            "rebounds": ("REB", float, 0.0),
            "assists": ("AST", float, 0.0),
            "steals": ("STL", float, 0.0),
            "blocks": ("BLK", float, 0.0),
            "turnovers": ("TOV", float, 0.0),
            "plusMinus": ("PLUS_MINUS", float, 0.0),
        },
    )

    return {
        "teamId": team_id,
        "season": target_season,
        "perMode": per_mode,
        "gamesPlayed": int(row.get("GP", 0) or 0),
        "averages": averages,
    }


def get_player_statistics(
    player_id: int,
    *,
    season: Optional[str] = None,
    per_mode: str = "PerGame",
) -> Dict[str, Any]:
    """Return aggregate statistics for a given player.

    Parameters
    ----------
    player_id : int
        The NBA player ID to retrieve statistics for.
    season : str, optional
        The season string (e.g. ``"2023-24"``). Defaults to the current season
        based on today's date.
    per_mode : str, optional
        The stat aggregation mode supported by ``nba_api`` (``"PerGame"``,
        ``"Totals"``, etc.). Defaults to ``"PerGame"``.

    Returns
    -------
    dict
        A dictionary containing the requested player's aggregate statistics.
    """

    target_season = season or _current_season()

    try:
        dashboard = (
            playerdashboardbygeneralsplits.PlayerDashboardByGeneralSplits(
                player_id=player_id,
                season=target_season,
                per_mode_detailed=per_mode,
            )
        )
        data = dashboard.get_normalized_dict()
    except (RequestException, NBAStatsHTTPException) as exc:
        raise RuntimeError("Failed to fetch player statistics") from exc

    player_dashboard = data.get("overallPlayerDashboard", [])
    if not player_dashboard:
        return {
            "playerId": player_id,
            "season": target_season,
            "perMode": per_mode,
            "gamesPlayed": 0,
            "averages": {},
        }

    row = player_dashboard[0]
    averages = _extract_fields(
        row,
        {
            "points": ("PTS", float, 0.0),
            "rebounds": ("REB", float, 0.0),
            "assists": ("AST", float, 0.0),
            "steals": ("STL", float, 0.0),
            "blocks": ("BLK", float, 0.0),
            "turnovers": ("TOV", float, 0.0),
            "fieldGoalPct": ("FG_PCT", float, 0.0),
            "threePointPct": ("FG3_PCT", float, 0.0),
            "freeThrowPct": ("FT_PCT", float, 0.0),
            "plusMinus": ("PLUS_MINUS", float, 0.0),
        },
    )

    return {
        "playerId": player_id,
        "season": target_season,
        "perMode": per_mode,
        "gamesPlayed": int(row.get("GP", 0) or 0),
        "averages": averages,
    }


def get_player_prop_recommendations(
    *,
    season: Optional[str] = None,
    per_mode: str = "PerGame",
    limit: int = 5,
) -> Dict[str, Any]:
    """Return high-level player aggregates suitable for prop exploration.

    The helper calls the NBA stats dashboard to retrieve player performance
    metrics, then ranks the results by a simple "prop score" that blends points,
    rebounds, and assists. This offers a quick starting point for identifying
    popular betting props when the caller does not request a specific player.

    Parameters
    ----------
    season : str, optional
        The season string (e.g. ``"2023-24"``). Defaults to the current season
        if omitted.
    per_mode : str, optional
        The stat aggregation mode supported by ``nba_api`` (``"PerGame"``,
        ``"Totals"``, etc.). Defaults to ``"PerGame"``.
    limit : int, optional
        The number of players to return. Defaults to 5 to keep payloads small.

    Returns
    -------
    dict
        A dictionary containing an ordered list of players with the computed
        "propScore" derived from their core counting stats.
    """

    target_season = season or _current_season()

    try:
        response = leaguedashplayerstats.LeagueDashPlayerStats(
            season=target_season,
            per_mode_detailed=per_mode,
            season_type_all_star="Regular Season",
        )
        frame = response.get_data_frames()[0]
    except (RequestException, NBAStatsHTTPException) as exc:
        raise RuntimeError("Failed to fetch player prop recommendations") from exc

    if frame.empty:
        return {
            "season": target_season,
            "perMode": per_mode,
            "players": [],
        }

    subset = frame.sort_values(by=["PTS", "REB", "AST"], ascending=False)

    recommendations = []
    for _, row in subset.head(limit).iterrows():
        points = float(row.get("PTS", 0.0) or 0.0)
        rebounds = float(row.get("REB", 0.0) or 0.0)
        assists = float(row.get("AST", 0.0) or 0.0)
        prop_score = points + (rebounds * 0.75) + (assists * 0.75)
        recommendations.append(
            {
                "playerId": int(row.get("PLAYER_ID", 0) or 0),
                "playerName": row.get("PLAYER_NAME", "Unknown"),
                "teamId": int(row.get("TEAM_ID", 0) or 0),
                "team": row.get("TEAM_ABBREVIATION", ""),
                "points": points,
                "rebounds": rebounds,
                "assists": assists,
                "usagePct": float(row.get("USG_PCT", 0.0) or 0.0),
                "propScore": round(prop_score, 2),
            }
        )

    return {
        "season": target_season,
        "perMode": per_mode,
        "players": recommendations,
    }


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
    games_played = float(totals.get("GP", 0.0) or 0.0)

    if games_played <= 0:
        return {"ppg": 0.0, "apg": 0.0, "rpg": 0.0}

    return {
        "ppg": float(totals.get("PTS", 0.0) or 0.0) / games_played,
        "apg": float(totals.get("AST", 0.0) or 0.0) / games_played,
        "rpg": float(totals.get("REB", 0.0) or 0.0) / games_played,
    }


def handle_nba_query(query: str) -> Dict[str, Any]:
    """Interpret a natural-language style query and dispatch to a helper.

    Any query that references the NBA will return a structured response. The
    interpreter honours explicit requests for scores, team statistics, player
    statistics, or player career averages while falling back to prop
    recommendations when the input lacks the identifiers needed for a targeted
    lookup.

    Parameters
    ----------
    query : str
        The user-provided text to analyse.

    Returns
    -------
    dict
        The payload returned by the corresponding helper.

    Raises
    ------
    ValueError
        If the query does not contain enough information to map to a helper.
    """

    normalized = " ".join(query.lower().split())

    if "nba" not in normalized:
        raise ValueError("Query does not appear to reference the NBA")

    fallback_payload: Optional[Dict[str, Any]] = None

    def _fallback() -> Dict[str, Any]:
        nonlocal fallback_payload
        if fallback_payload is None:
            fallback_payload = get_player_prop_recommendations()
        return fallback_payload

    if "live" in normalized and "score" in normalized:
        return get_live_scores()

    if "team" in normalized and "stat" in normalized:
        team_id = _extract_first_integer(normalized)
        if team_id is None:
            return {
                "message": "Team stats requested without an explicit ID.",
                "recommendations": _fallback(),
            }
        return get_team_statistics(team_id)

    if "player" in normalized and "career" in normalized:
        player_id = _extract_first_integer(normalized)
        if player_id is None:
            return {
                "message": "Player career stats requested without an ID.",
                "recommendations": _fallback(),
            }
        averages = get_player_career_stats(player_id)
        return {"playerId": player_id, "careerAverages": averages}

    if "player" in normalized and "stat" in normalized:
        player_id = _extract_first_integer(normalized)
        if player_id is None:
            return {
                "message": "Player stats requested without an ID.",
                "recommendations": _fallback(),
            }
        return get_player_statistics(player_id)

    if "prop" in normalized or "bet" in normalized or "odds" in normalized:
        return _fallback()

    return _fallback()


def _extract_fields(
    row: Mapping[str, Any],
    mapping: Mapping[str, tuple[str, type, Any]],
) -> Dict[str, Any]:
    """Helper to project and cast values from an API row."""

    extracted: Dict[str, Any] = {}
    for key, (source, caster, default) in mapping.items():
        value = row.get(source, default)
        try:
            extracted[key] = caster(value if value is not None else default)
        except (TypeError, ValueError):
            extracted[key] = default
    return extracted


def _extract_first_integer(text: str) -> Optional[int]:
    """Return the first integer embedded in ``text`` if one exists."""

    match = re.search(r"(\d+)", text)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _current_season(today: Optional[date] = None) -> str:
    """Derive the NBA season string (e.g. ``"2023-24"``) for today's date."""

    today = today or date.today()
    year = today.year
    if today.month >= 10:
        start_year = year
    else:
        start_year = year - 1
    end_year = (start_year + 1) % 100
    return f"{start_year}-{end_year:02d}"


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


def _build_cli() -> argparse.ArgumentParser:
    """Create the CLI parser for interactive usage."""

    parser = argparse.ArgumentParser(description="NBA data helper utilities")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--scores",
        action="store_true",
        help="Display today's NBA scoreboard (default action)",
    )
    group.add_argument(
        "--team",
        type=int,
        metavar="TEAM_ID",
        help="Fetch aggregate statistics for the provided team ID",
    )
    group.add_argument(
        "--player",
        type=int,
        metavar="PLAYER_ID",
        help="Fetch aggregate statistics for the provided player ID",
    )
    group.add_argument(
        "--props",
        action="store_true",
        help="Show recommended NBA player props based on blended averages",
    )
    group.add_argument(
        "--query",
        type=str,
        metavar="TEXT",
        help=(
            "Interpret a structured natural-language request (e.g. 'live NBA "
            "scores' or 'team stats for 1610612744')."
        ),
    )
    parser.add_argument(
        "--season",
        type=str,
        help="Season string such as 2023-24. Defaults to the current season.",
    )
    parser.add_argument(
        "--per-mode",
        type=str,
        default="PerGame",
        help="nba_api per-mode value (PerGame, Totals, Per36, etc.).",
    )
    return parser


def main() -> None:
    """Entry point for CLI execution."""

    parser = _build_cli()
    args = parser.parse_args()

    if args.query:
        try:
            payload = handle_nba_query(args.query)
        except ValueError as exc:
            parser.error(str(exc))
        print(json.dumps(payload, indent=2))
        if "games" in payload:
            print("\nFormatted output:")
            _print_sample_output()
        return

    if args.player is not None:
        payload = get_player_statistics(
            args.player,
            season=args.season,
            per_mode=args.per_mode,
        )
        print(json.dumps(payload, indent=2))
        return

    if args.team is not None:
        payload = get_team_statistics(
            args.team,
            season=args.season,
            per_mode=args.per_mode,
        )
        print(json.dumps(payload, indent=2))
        return

    if args.props:
        payload = get_player_prop_recommendations(
            season=args.season,
            per_mode=args.per_mode,
        )
        print(json.dumps(payload, indent=2))
        return

    payload = get_live_scores()
    print(json.dumps(payload, indent=2))
    print("\nFormatted output:")
    _print_sample_output()


if __name__ == "__main__":
    main()
