import requests


class AnidbIdApi:
    def get_anidb_id(self, anilist_url):
        base_url = "https://find-my-anime.dtimur.de/api?id=9253&provider=Anilist&includeAdult=true&collectionConsent=false"

        base_url2 = "https://api.ani.zip/v1/mappings?anilist_id=16498"

        base_url3 = "https://zenshin-supabase-api.onrender.com/mappings?anilist_id=16498"

    def get_anilist_id(self, anilist_url):
        pass



if __name__ == "__main__":
    print(AnidbIdApi().get_anidb_id("https://anilist.co/anime/9253/SteinsGate/"))
