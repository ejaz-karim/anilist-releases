import requests


class AnidbIdApi:
    def get_anidb_id(self, anilist_url):
        base_url = "https://find-my-anime.dtimur.de/api?id=9253&provider=Anilist&includeAdult=true&collectionConsent=false"


if __name__ == "__main__":
    print(AnidbIdApi().get_anidb_id("https://anilist.co/anime/9253/SteinsGate/"))
