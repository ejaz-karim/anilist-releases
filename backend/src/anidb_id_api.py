import requests


class AnidbIdApi:
    def get_anidb_id(self, anilist_id):
        # base_url = "https://find-my-anime.dtimur.de/api?id=9253&provider=Anilist&includeAdult=true&collectionConsent=false"

        find_my_anime_url = f"https://find-my-anime.dtimur.de/api?id={anilist_id}&provider=Anilist&includeAdult=true&collectionConsent=false"
        fma_response = requests.get(find_my_anime_url)
        fma_response.raise_for_status()

        fma_data = fma_response.json()
        fma_sources = fma_data[0].get("sources")


        print(fma_sources)






        # base_url2 = "https://api.ani.zip/v1/mappings?anilist_id=16498"

        # base_url3 = (
        #     "https://zenshin-supabase-api.onrender.com/mappings?anilist_id=16498"
        # )

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


if __name__ == "__main__":
    print(AnidbIdApi().get_anidb_id("9253"))
