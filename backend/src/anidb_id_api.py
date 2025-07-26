import requests


class AnidbIdApi:
    def get_anidb_id(self, anilist_id):
        try:
            find_my_anime_api_url = f"https://find-my-anime.dtimur.de/api?id={anilist_id}&provider=Anilist&includeAdult=true&collectionConsent=false"
            fma_response = requests.get(find_my_anime_api_url)
            fma_response.raise_for_status()
            fma_data = fma_response.json()
            fma_anidb_id = fma_data[0].get("providerMapping").get("AniDB")
            return fma_anidb_id
        except (requests.RequestException, KeyError, IndexError, TypeError):
            pass

        try:
            api_ani_url = f"https://api.ani.zip/v1/mappings?anilist_id={anilist_id}"
            api_ani_response = requests.get(api_ani_url)
            api_ani_response.raise_for_status()
            api_ani_data = api_ani_response.json()
            api_ani_anidb_id = api_ani_data.get("anidb_id")
            return api_ani_anidb_id
        except (requests.RequestException, ValueError, KeyError, TypeError):
            pass

        try:
            zenshin_api_url = f"https://zenshin-supabase-api.onrender.com/mappings?anilist_id={anilist_id}"
            zenshin_response = requests.get(zenshin_api_url)
            zenshin_response.raise_for_status()
            zenshin_data = zenshin_response.json()
            zenshin_anidb_id = zenshin_data.get("mappings").get("anidb_id")
            return zenshin_anidb_id
        except (requests.RequestException, ValueError, KeyError, TypeError):
            pass

        return None

    def get_anilist_id(self, anilist_url):
        if "://" in anilist_url:
            url = anilist_url.split("://", 1)[1]
        else:
            url = anilist_url

        url = url.lower()

        if url.endswith("/"):
            url = url[:-1]

        parts = url.split("/")

        valid_domains = {"anilist.co", "www.anilist.co"}
        if any(domain in parts for domain in valid_domains) and "anime" in parts:
            anime_index = parts.index("anime")
            if anime_index + 1 < len(parts):
                anime_id = parts[anime_index + 1]
                if anime_id.isdigit():
                    return anime_id
        return None
    
    def get_anidb_groups(self, anidb_id):
        pass


if __name__ == "__main__":
    print(AnidbIdApi().get_anidb_groups("7729"))
