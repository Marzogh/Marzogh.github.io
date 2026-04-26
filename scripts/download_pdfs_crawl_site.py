import argparse
import os
import re
from collections import deque
from urllib.parse import urldefrag, urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PDFSiteCrawler/1.0)"
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


def same_site(url: str, start_url: str) -> bool:
    return urlparse(url).netloc == urlparse(start_url).netloc


def normalise_url(url: str) -> str:
    url, _fragment = urldefrag(url)
    return url


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


def crawl_for_pdfs(
    start_url: str,
    session: requests.Session,
    max_pages: int,
    max_depth: int,
) -> list[str]:
    seen_pages = set()
    seen_pdfs = set()
    queue = deque([(normalise_url(start_url), 0)])

    while queue and len(seen_pages) < max_pages:
        page_url, depth = queue.popleft()

        if page_url in seen_pages:
            continue

        seen_pages.add(page_url)
        print(f"Scanning: {page_url}")

        try:
            response = session.get(page_url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Failed to read page: {page_url} ({e})")
            continue

        content_type = response.headers.get("Content-Type", "").lower()
        if "html" not in content_type:
            continue

        soup = BeautifulSoup(response.text, "html.parser")

        for link in soup.find_all("a", href=True):
            href = link["href"].strip()
            absolute_url = normalise_url(urljoin(page_url, href))

            if is_pdf_link(absolute_url):
                seen_pdfs.add(absolute_url)
                continue

            if depth < max_depth and same_site(absolute_url, start_url):
                scheme = urlparse(absolute_url).scheme
                if scheme in {"http", "https"} and absolute_url not in seen_pages:
                    queue.append((absolute_url, depth + 1))

    return sorted(seen_pdfs)


def download_site_pdfs(
    start_url: str,
    output_folder: str = "downloaded_pdfs",
    max_pages: int = 50,
    max_depth: int = 2,
) -> None:
    os.makedirs(output_folder, exist_ok=True)

    with requests.Session() as session:
        session.headers.update(HEADERS)
        pdf_links = crawl_for_pdfs(start_url, session, max_pages, max_depth)

        if not pdf_links:
            print("No PDF links found.")
            return

        print(f"Found {len(pdf_links)} PDF link(s).")

        for pdf_url in pdf_links:
            download_file(pdf_url, output_folder, session)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crawl pages on the same site and download directly linked PDFs."
    )
    parser.add_argument("url", help="Starting webpage URL")
    parser.add_argument("output_folder", nargs="?", default="downloaded_pdfs")
    parser.add_argument("--max-pages", type=int, default=50)
    parser.add_argument("--max-depth", type=int, default=2)
    args = parser.parse_args()

    download_site_pdfs(args.url, args.output_folder, args.max_pages, args.max_depth)


if __name__ == "__main__":
    main()
