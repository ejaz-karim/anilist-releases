import requests


class SeadexApi:
    def get_release_data(self, anilist_id):
        base_url = "https://releases.moe/api/collections/entries/records"
        trs_url = f"{base_url}?filter=alID={anilist_id}&expand=trs"
        response = requests.get(trs_url)
        response.raise_for_status()

        data = response.json()

        items = data.get("items")
        items = items[0] if items else None

        comparison = items.get("comparison")
        notes = items.get("notes")
        theoretical_best = items.get("theoreticalBest")

        release_dict = {
            "comparison": comparison,
            "notes": notes,
            "theoretical best": theoretical_best,
            "releases": [],
        }

        trs = items.get("expand")
        trs = trs.get("trs")

        for entry in trs:
            tracker = entry.get("tracker")
            release_group = entry.get("releaseGroup")
            url = entry.get("url")
            dual_audio = entry.get("dualAudio")
            is_best = entry.get("isBest")

            files = entry.get("files")
            total_file_size = 0

            episode_list = []

            for file in files:
                name = file.get("name")
                file_size_format = self.format_file_size(file.get("length"))
                total_file_size += file.get("length", 0)

                episode_list.append({"name": name, "size": file_size_format})

            total_file_size_format = self.format_file_size(total_file_size)

            if entry.get("infoHash") == "<redacted>":
                private_tracker = True
            else:
                private_tracker = False

            entry_dict = {
                "tracker": tracker,
                "release group": release_group,
                "url": url,
                "dual audio": dual_audio,
                "is best": is_best,
                "private tracker": private_tracker,
                "file size": total_file_size_format,
                "episode list": episode_list,
            }

            release_dict["releases"].append(entry_dict)

        return release_dict

    def format_file_size(self, bytes):
        megabytes = bytes / (1024**2)
        gigabytes = bytes / (1024**3)

        if gigabytes >= 1:
            return f"{round(gigabytes, 1)}" + " GiB"
        else:
            return f"{round(megabytes, 1)}" + " MiB"


if __name__ == "__main__":
    print(SeadexApi().get_release_data(104276))
