import os
import re
import sys
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup


def safe_filename_from_url(url: str, fallback: str = "downloaded.pdf") -> str:
    """
    Create a safe local filename from a URL.
    """
    path = urlparse(url).path
    name = os.path.basename(path)
    name = unquote(name).strip()

    if not name:
        name = fallback

    name = re.sub(r'[<>:"/\\|?*]+', "_", name)

    if not name.lower().endswith(".pdf"):
        name += ".pdf"

    return name


def is_pdf_link(url: str) -> bool:
    """
    Check whether a URL looks like a PDF link.
    """
    path = urlparse(url).path.lower()
    return path.endswith(".pdf")


def download_file(url: str, output_folder: str, session: requests.Session) -> None:
    """
    Download a PDF file to the output folder.
    """
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
            if "pdf" not in content_type and not url.lower().endswith(".pdf"):
                print(f"Skipping non-PDF response: {url}")
                return

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

        print(f"Downloaded: {url} -> {filepath}")

    except requests.RequestException as e:
        print(f"Failed to download {url}: {e}")


def find_pdf_links(webpage_url: str) -> list[str]:
    """
    Find all PDF links on a webpage.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; PDFDownloader/1.0)"
    }

    with requests.Session() as session:
        session.headers.update(headers)

        response = session.get(webpage_url, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        pdf_links = set()

        for link in soup.find_all("a", href=True):
            href = link["href"].strip()
            absolute_url = urljoin(webpage_url, href)

            if is_pdf_link(absolute_url):
                pdf_links.add(absolute_url)

        return sorted(pdf_links)


def download_all_pdfs(webpage_url: str, output_folder: str = "downloaded_pdfs") -> None:
    """
    Find and download all PDF links from the given webpage.
    """
    os.makedirs(output_folder, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; PDFDownloader/1.0)"
    }

    try:
        pdf_links = find_pdf_links(webpage_url)
    except requests.RequestException as e:
        print(f"Failed to read webpage: {e}")
        return

    if not pdf_links:
        print("No PDF links found on the page.")
        return

    print(f"Found {len(pdf_links)} PDF link(s).")

    with requests.Session() as session:
        session.headers.update(headers)

        for pdf_url in pdf_links:
            download_file(pdf_url, output_folder, session)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_pdfs.py <webpage_url> [output_folder]")
        sys.exit(1)

    url = sys.argv[1]
    folder = sys.argv[2] if len(sys.argv) > 2 else "downloaded_pdfs"

    download_all_pdfs(url, folder)
