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

        return metadata


if __name__ == "__main__":
    print(NyaaScraper().get_metadata("https://nyaa.si/view/1830747"))
