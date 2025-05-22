from bs4 import BeautifulSoup
import requests


class NyaaScraper:
    def get_metadata(self, url):
        metadata = {}
        response = requests.get(url)
        soup = BeautifulSoup(response.text, "html.parser")

        title_tag = soup.select_one("div.panel-heading h3.panel-title")
        metadata["release name"] = title_tag.text.strip() if title_tag else None

        magnet_tag = soup.find("a", href=lambda x: x and x.startswith("magnet:"))
        metadata["magnet"] = magnet_tag["href"] if magnet_tag else None

        rows = soup.select("div.panel-body .row")
        for row in rows:
            cols = row.find_all("div")
            if len(cols) < 4:
                continue
            label1, val1 = cols[0].text.strip(" :"), cols[1].text.strip()
            label2, val2 = cols[2].text.strip(" :"), cols[3].text.strip()
            if label1 == "File size":
                metadata["file_size"] = val1
            if label2 == "Completed":
                metadata["completed"] = val2

        for row in rows:
            cols = row.find_all("div")
            for i in range(0, len(cols) - 1, 2):
                label = cols[i].text.strip(" :")
                value = cols[i + 1]
                if label == "Seeders":
                    metadata["seeders"] = value.text.strip()
                elif label == "Leechers":
                    metadata["leechers"] = value.text.strip()
                elif label == "Date":
                    metadata["date"] = value.text.strip()
                elif label == "Submitter":
                    user = value.find("a")
                    metadata["submitter"] = (
                        user.text.strip() if user else value.text.strip()
                    )
                elif label == "Category":
                    cats = value.find_all("a")
                    metadata["category"] = " - ".join(c.text.strip() for c in cats)

        file_panel = soup.find("div", class_="torrent-file-list")
        root_ul = file_panel.find("ul") if file_panel else None
        metadata["files"] = self.parse_file_list(root_ul) if root_ul else []

        return metadata

    def parse_file_list(self, ul_tag, parent_path=""):
        files = []
        for li in ul_tag.find_all("li", recursive=False):
            folder_link = li.find("a", class_="folder")
            if folder_link:
                folder_name = folder_link.text.strip()
                nested_ul = li.find("ul")
                contents = (
                    self.parse_file_list(
                        nested_ul, f"{parent_path}/{folder_name}".strip("/")
                    )
                    if nested_ul
                    else []
                )
                files.append({"folder": folder_name, "contents": contents})
            else:
                file_icon = li.find("i", class_="fa-file")
                size_span = li.find("span", class_="file-size")
                if file_icon:
                    file_name = file_icon.next_sibling.strip()
                    file_size = size_span.text.strip() if size_span else "Unknown"
                    files.append({"name": file_name, "size": file_size})
        return files


if __name__ == "__main__":
    print(NyaaScraper().get_metadata("https://nyaa.si/view/1830747"))
