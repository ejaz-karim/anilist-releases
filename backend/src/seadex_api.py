import requests

class SeadexApi:
    def get_release_groups(self, anilist_id):
        base_url = "https://releases.moe/api/collections/entries/records"
        release_data = f"{base_url}?filter=alID={anilist_id}&expand=trs"
        response = requests.get(release_data)
        response.raise_for_status()

        
        data = response.json()





if __name__ == "__main__":
    print(SeadexApi().get_release_groups())

