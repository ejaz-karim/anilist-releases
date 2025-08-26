import requests
import re
from bs4 import BeautifulSoup
import nyaa_scraper


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

    def get_anidb_episode_ids(self, anilist_id):
        try:
            zenshin_api_url = f"https://zenshin-supabase-api.onrender.com/mappings?anilist_id={anilist_id}"
            zenshin_response = requests.get(zenshin_api_url)
            zenshin_response.raise_for_status()
            zenshin_data = zenshin_response.json()
            zenshin_episodes = zenshin_data.get("episodes")

            episodes = []
            for i in zenshin_episodes.values():
                episode = {}
                episode["episode"] = i.get("episode")
                episode["anidb_episode_id"] = i.get("anidbEid")
                episode["title"] = i.get("title").get("en")
                episodes.append(episode)
            return episodes

        except (requests.RequestException, ValueError, KeyError, TypeError):
            pass

        return None

    # For the typescript extension, use /src/utility.ts getAnilistId()
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

    # Deprecated, use get_animetosho_metadata()
    def get_anidb_groups(self, anidb_id):
        anidb_url = f"https://anidb.net/anime/{anidb_id}/?showallag=1#grouplist"

        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.742.100 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }

        response = requests.get(anidb_url, headers=headers)
        soup = BeautifulSoup(response.text, "html.parser")

        release_groups = soup.select_one(
            "div.container.g_bubble > table#grouplist > tbody"
        )

        data = []

        for row in release_groups.select("tr"):
            state = row.select_one("td.state")
            if state:
                state_text = state.get_text(strip=True).lower()
                if state_text not in ["ongoing", "complete"]:
                    continue
            else:
                continue

            last_update = row.select_one("td.date.lastupdate")
            name = row.select_one("td.name.group a")
            note = row.select_one("td.note span.i_icon")
            languages = row.select("td.icons.languages span.i_icon")
            source = row.select_one("td.source")

            data.append(
                {
                    "last_update": last_update.get_text(strip=True)
                    if last_update
                    else None,
                    "name": (
                        match.group(1)
                        if (
                            match := re.search(
                                r"\[([^\]]+)\]", name.get_text(strip=True)
                            )
                        )
                        else name.get_text(strip=True)
                    )
                    if name
                    else None,
                    "state": state_text,
                    "note": note.get("title") if note else None,
                    "languages": [
                        {
                            "type": title.split(" | ")[0].strip(),
                            "language": title.split(" | ")[1].split(":")[1].strip(),
                        }
                        for lang in languages
                        if (title := lang.get("title"))
                    ],
                    "source": source.get_text(strip=True) if source else None,
                }
            )

        return data

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

    # rate limited, use get_animetosho_metadata()
    def get_animetosho_nyaa_url(self, url):
        try:
            response = requests.get(url)
            response.raise_for_status()
        except requests.exceptions.RequestException:
            return None
        soup = BeautifulSoup(response.text, "html.parser")

        nyaa_url = soup.find(
            "a", href=lambda href: href and href.startswith("https://nyaa.si/view/")
        )

        if nyaa_url:
            return nyaa_url["href"]
        else:
            return None

    def get_nyaa_anidb_episode(self, anilist_id, episode):
        episodes = AnidbIdApi.get_anidb_episode_ids(self, anilist_id)
        for i in episodes:
            if i.get("episode") == str(episode):
                anidb_episode_id = i.get("anidb_episode_id")
                metadata = AnidbIdApi.get_animetosho_metadata(
                    self, None, anidb_episode_id
                )
                return metadata
        return None


if __name__ == "__main__":
    pass
