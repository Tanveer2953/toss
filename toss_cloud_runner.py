import json
import os
import secrets
import time

DATA_FILE = "data.json"

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "total": 0,
        "heads": 0,
        "tails": 0,
        "currentStreak": {"type": None, "count": 0},
        "maxHeadsStreak": 0,
        "maxTailsStreak": 0,
        "last_toss_timestamp": int(time.time()),
        "history": []
    }

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def run_cloud_flips():
    data = load_data()
    now = int(time.time())
    last_ts = data.get("last_toss_timestamp", now - 300)
    
    # Calculate seconds passed since last run (e.g., 300 seconds for 5 minutes)
    seconds_elapsed = max(1, now - last_ts)
    
    print(f"Executing {seconds_elapsed} cloud background flips using secrets.randbelow(2)...")
    
    for i in range(seconds_elapsed):
        # Hardware true random choice via OS CSPRNG (secrets module)
        result = "H" if secrets.randbelow(2) == 0 else "T"
        
        data["total"] += 1
        if result == "H":
            data["heads"] += 1
        else:
            data["tails"] += 1
            
        # Streaks
        curr_streak = data.get("currentStreak", {"type": None, "count": 0})
        if curr_streak["type"] == result:
            curr_streak["count"] += 1
        else:
            curr_streak["type"] = result
            curr_streak["count"] = 1
        data["currentStreak"] = curr_streak
        
        if result == "H" and curr_streak["count"] > data.get("maxHeadsStreak", 0):
            data["maxHeadsStreak"] = curr_streak["count"]
            
        if result == "T" and curr_streak["count"] > data.get("maxTailsStreak", 0):
            data["maxTailsStreak"] = curr_streak["count"]
            
        # History log (keep last 20)
        history = data.get("history", [])
        history.insert(0, {
            "id": data["total"],
            "result": result,
            "timestamp": time.strftime("%H:%M:%S UTC", time.gmtime(last_ts + i))
        })
        data["history"] = history[:20]

    data["last_toss_timestamp"] = now
    save_data(data)
    print(f"Done! New Cloud State: Total: {data['total']}, Heads: {data['heads']} ({data['heads']/data['total']*100:.2f}%), Tails: {data['tails']}")

if __name__ == "__main__":
    run_cloud_flips()
