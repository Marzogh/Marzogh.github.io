import argparse
import os
import re
import time
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options


HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PDFSeleniumDownloader/1.0)"
}


def safe_filename_from_url(url: str, fallback: str = "downloaded.pdf") -> str:
    path = urlparse(url).path
    name = unquote(os.path.basename(path)).strip() or fallback
    name = re.sub(r'[<>:"/\\|?*]+', "_", name)

    if not name.lower().endswith(".pdf"):
        name += ".pdf"

    return name


def is_pdf_link(url: str) -> bool:
    return urlparse(url).path.lower().endswith(".pdf")


def download_file(url: str, output_folder: str, session: requests.Session) -> None:
    filename = safe_filename_from_url(url)
    filepath = os.path.join(output_folder, filename)

    base, ext = os.path.splitext(filename)
    counter = 1
    while os.path.exists(filepath):
        filepath = os.path.join(output_folder, f"{base}_{counter}{ext}")
        counter += 1

    try:
        with session.get(url, stream=True, timeout=30) as response:
            response.raise_for_status()

            content_type = response.headers.get("Content-Type", "").lower()
            if "pdf" not in content_type and not is_pdf_link(url):
                print(f"Skipping non-PDF response: {url}")
                return

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

        print(f"Downloaded: {url} -> {filepath}")

    except requests.RequestException as e:
        print(f"Failed to download {url}: {e}")


def find_pdf_links_with_selenium(webpage_url: str, wait_seconds: float = 3.0) -> list[str]:
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")

    driver = webdriver.Chrome(options=chrome_options)

    try:
        driver.get(webpage_url)
        time.sleep(wait_seconds)

        soup = BeautifulSoup(driver.page_source, "html.parser")
        pdf_links = set()

        for link in soup.find_all("a", href=True):
            absolute_url = urljoin(webpage_url, link["href"].strip())

            if is_pdf_link(absolute_url):
                pdf_links.add(absolute_url)

        return sorted(pdf_links)

    finally:
        driver.quit()


def download_all_pdfs(
    webpage_url: str,
    output_folder: str = "downloaded_pdfs",
    wait_seconds: float = 3.0,
) -> None:
    os.makedirs(output_folder, exist_ok=True)

    pdf_links = find_pdf_links_with_selenium(webpage_url, wait_seconds)

    if not pdf_links:
        print("No PDF links found on the rendered page.")
        return

    print(f"Found {len(pdf_links)} PDF link(s).")

    with requests.Session() as session:
        session.headers.update(HEADERS)

        for pdf_url in pdf_links:
            download_file(pdf_url, output_folder, session)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a JavaScript-heavy page with Selenium and download direct PDF links."
    )
    parser.add_argument("url", help="Webpage URL")
    parser.add_argument("output_folder", nargs="?", default="downloaded_pdfs")
    parser.add_argument("--wait", type=float, default=3.0, help="Seconds to wait after page load")
    args = parser.parse_args()

    download_all_pdfs(args.url, args.output_folder, args.wait)


if __name__ == "__main__":
    main()
