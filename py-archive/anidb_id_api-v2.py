import requests
import re
from bs4 import BeautifulSoup
import nyaa_scraper


class AnidbIdApi:
    def get_anidb_id(self, anilist_id):

        try:
            api_ani_url = f"https://api.ani.zip/mappings?anilist_id={anilist_id}"
            api_ani_response = requests.get(api_ani_url)
            api_ani_response.raise_for_status()
            api_ani_data = api_ani_response.json()

            api_ani_anidb_id = api_ani_data.get("mappings").get("anidb_id")
            api_ani_episodes = api_ani_data.get("episodes")

            result = {"anidb_id": api_ani_anidb_id, "episodes": []}

            for i in api_ani_episodes.values():
                episode = {}
                episode["episode"] = i.get("episode")
                episode["anidb_episode_id"] = i.get("anidbEid")
                episode["title"] = i.get("title").get("en")
                result["episodes"].append(episode)

            return result

        except (requests.RequestException, ValueError, KeyError, TypeError):
            pass

        try:
            zenshin_api_url = f"https://zenshin-supabase-api.onrender.com/mappings?anilist_id={anilist_id}"
            zenshin_response = requests.get(zenshin_api_url)
            zenshin_response.raise_for_status()
            zenshin_data = zenshin_response.json()

            zenshin_anidb_id = zenshin_data.get("mappings").get("anidb_id")
            zenshin_episodes = zenshin_data.get("episodes")

            result = {"anidb_id": zenshin_anidb_id, "episodes": []}

            for i in zenshin_episodes.values():
                episode = {}
                episode["episode"] = i.get("episode")
                episode["anidb_episode_id"] = i.get("anidbEid")
                episode["title"] = i.get("title").get("en")
                result["episodes"].append(episode)

            return result

        except (requests.RequestException, ValueError, KeyError, TypeError):
            pass

        return None


    def get_animetosho_metadata(self, anidb_id=None, anidb_episode_id=None):
        if not anidb_id and not anidb_episode_id:
            raise ValueError("Missing anidb id or anidb episode id")
        if anidb_id and anidb_episode_id:
            raise ValueError(
                "Not allowed to parse both anidb id and anidb episode id at the same time"
            )

        results = []

        if anidb_id:
            url = f"https://feed.animetosho.org/json?aid={anidb_id}"
        if anidb_episode_id:
            url = f"https://feed.animetosho.org/json?eid={anidb_episode_id}"

        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        scraper = nyaa_scraper.NyaaScraper()

        for entry in data:
            info_hash = entry.get("info_hash")

            if info_hash is not None:
                nyaa_url = f"https://nyaa.si/?q={info_hash}"
                nyaa_metadata = scraper.get_metadata(nyaa_url)
            else:
                continue

            if nyaa_metadata is None:
                continue
            elif int(nyaa_metadata["seeders"]) > 0:
                results.append(nyaa_metadata)

        sorted_results = sorted(results, key=lambda x: int(x["seeders"]), reverse=True)
        if not sorted_results:
            print("No releases have any seeders available")
            return None
        else:
            return sorted_results


    def get_nyaa_anidb_episode(self, anilist_id, episode):
        dict = AnidbIdApi.get_anidb_id(self, anilist_id)
        episodes = dict["episodes"]

        for i in episodes:
            if i.get("episode") == str(episode):
                anidb_episode_id = i.get("anidb_episode_id")
                metadata = AnidbIdApi.get_animetosho_metadata(
                    self, None, anidb_episode_id
                )
                return metadata
        return None


if __name__ == "__main__":
    # print(AnidbIdApi().get_anidb_id(9253))
    print(AnidbIdApi().get_nyaa_anidb_episode(21, 1000))
