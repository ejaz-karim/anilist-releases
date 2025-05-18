import requests


class SeadexApi:
    def get_release_data(self, anilist_id):
        base_url = "https://releases.moe/api/collections/entries/records"
        trs_url = f"{base_url}?filter=alID={anilist_id}&expand=trs"
        response = requests.get(trs_url)
        response.raise_for_status()

        data = response.json()
        items = data.get["items"][0]

        comparison = items.get("comparison")
        notes = items.get("notes")
        theoretical_best = items.get("theoreticalBest")

        trs = items["expand"]["trs"]

        for entry in trs:
            tracker = entry.get("tracker")
            release_group = entry.get("releaseGroup")
            url = entry.get("url")
            dual_audio = entry.get("dualAudio")
            is_best = entry.get("isBest")

            files = entry.get("files")

            for file in files:
                name = file.get("name")
                file_size = self.format_file_size(file.get("length"))

            if entry.get("infoHash") == "<redacted>":
                private_tracker = True
            else:
                private_tracker = False



    def format_file_size(self, bytes):
        megabytes = bytes / (1024**2)
        gigabytes = bytes / (1024**3)

        if gigabytes >= 1:
            return f"{round(gigabytes, 1)}" + " GiB"
        else:
            return f"{round(megabytes, 1)}" + " MiB"


if __name__ == "__main__":
    SeadexApi().get_release_data(18897)
