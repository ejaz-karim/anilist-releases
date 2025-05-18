import requests
import json

class SeadexApi:
    def get_release_data(self, anilist_id):
        base_url = "https://releases.moe/api/collections/entries/records"
        trs_url = f"{base_url}?filter=alID={anilist_id}&expand=trs"
        response = requests.get(trs_url)
        response.raise_for_status()

        
        data = response.json()
        items = data["items"][0]
        comparison = items["comparison"]
        notes = items["notes"]
        theoretical_best = items["theoreticalBest"]

        
        trs = items["expand"]["trs"]

        for entry in trs:
            tracker = entry.get("tracker")
            release_group = entry["releaseGroup"]

            print(tracker)



        # release = data["items"][0]["expand"]["trs"][0]["releaseGroup"]
       





if __name__ == "__main__":
    print(SeadexApi().get_release_data(18897))
    SeadexApi().get_release_data(18897)


