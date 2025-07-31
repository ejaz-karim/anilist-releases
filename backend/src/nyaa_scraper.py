from bs4 import BeautifulSoup
import requests


class NyaaScraper:
    def get_metadata(self, url):
        metadata = {}
        try:
            response = requests.get(url)
            response.raise_for_status()
        except requests.exceptions.RequestException:
            return None
        soup = BeautifulSoup(response.text, "html.parser")

        title = soup.title.string.strip()
        release_name = title.removesuffix(":: Nyaa").strip()

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

        files = soup.select_one("div.torrent-file-list.panel-body")
        metadata["files"] = self.format_files(files)

        return metadata

    def format_files(self, files):
        items = []

        if files.name == "div":
            files = files.find("ul")
            if not files:
                return items

        for list_item in files.find_all("li", recursive=False):
            folder = list_item.find("a", class_="folder")
            if folder:
                folder_name = folder.get_text(strip=True)
                nested_ul = list_item.find("ul")
                contents = self.format_files(nested_ul) if nested_ul else []
                items.append(
                    {"type": "folder", "name": folder_name, "contents": contents}
                )
            else:
                file_icon = list_item.find("i", class_="fa-file")
                size_span = list_item.find("span", class_="file-size")
                if file_icon:
                    file_name = (
                        file_icon.next_sibling.strip() if file_icon.next_sibling else ""
                    )
                    file_size = size_span.get_text(strip=True) if size_span else None
                    items.append({"type": "file", "name": file_name, "size": file_size})

        return items


if __name__ == "__main__":
    print(NyaaScraper().get_metadata("https://nyaa.si/view/1960108"))
    # print(NyaaScraper().get_metadata("https://nyaa.si/view/1577473"))
