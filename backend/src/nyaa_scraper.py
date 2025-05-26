from bs4 import BeautifulSoup
import requests


class NyaaScraper:
    def get_metadata(self, url):
        metadata = {}
        response = requests.get(url)
        soup = BeautifulSoup(response.text, "html.parser")

        release_name = soup.select_one(
            "div.container > div.panel.panel-default > div.panel-heading > h3.panel-title"
        )
        release_name = release_name.text.strip()
        metadata["release name"] = release_name

        magnet = soup.select_one("div.panel-footer.clearfix a[href^='magnet']")
        magnet = magnet.get("href")
        metadata["magnet"] = magnet

        rows_list = []
        for row in soup.select("div.panel-body .row"):
            for line in row.text.strip().splitlines():
                if line.strip():
                    rows_list.append(line.strip())

        for i, element in enumerate(rows_list):
            match element:
                case "Category:":
                    if i + 1 < len(rows_list):
                        metadata["category"] = rows_list[i + 1]
                case "Date:":
                    if i + 1 < len(rows_list):
                        metadata["date"] = rows_list[i + 1]
                case "Submitter:":
                    if i + 1 < len(rows_list):
                        metadata["submitter"] = rows_list[i + 1]
                case "Seeders:":
                    if i + 1 < len(rows_list):
                        metadata["seeders"] = rows_list[i + 1]
                case "Leechers:":
                    if i + 1 < len(rows_list):
                        metadata["leechers"] = rows_list[i + 1]
                case "File size:":
                    if i + 1 < len(rows_list):
                        metadata["file size"] = rows_list[i + 1]
                case "Completed:":
                    if i + 1 < len(rows_list):
                        metadata["completed"] = rows_list[i + 1]

        return metadata


if __name__ == "__main__":
    print(NyaaScraper().get_metadata("https://nyaa.si/view/1830747"))
