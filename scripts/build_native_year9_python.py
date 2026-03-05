#!/usr/bin/env python3
from __future__ import annotations

import textwrap
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "src" / "content" / "education"


@dataclass(frozen=True)
class Page:
    target: str
    title: str
    description: str
    order: int
    page_type: str
    show_in_index: bool
    featured: bool
    tags: tuple[str, ...]
    source: str | None = None
    intro: str = ""
    links_heading: str | None = None
    links: tuple[tuple[str, str], ...] = ()
    note: str | None = None


PAGES: list[Page] = [
    Page(
        target="year-9-python-foundations.mdx",
        title="Year 9 Python Foundations",
        description="An overview of the Year 9 Python unit, with setup, lesson pathways, and the core project sequence.",
        order=1,
        page_type="unit-overview",
        show_in_index=True,
        featured=True,
        tags=("python", "year-9", "unit-overview", "curriculum"),
        source="welcome-to-unit-1-all-about-python.html",
        intro="This unit starts with Python fundamentals and builds toward structured problem-solving, debugging, and project work. Use this page as the main entry point for the unit.",
        links_heading="Start Here",
        links=(
            ("Install Python with Thonny", "/education/install-python-with-thonny"),
            ("Writing Good Code", "/education/writing-good-code"),
            ("Python Basics Hub", "/education/python-basics-hub"),
            ("Pet Services Project", "/education/pet-services-project"),
            ("Programming Reference", "/education/python-reference"),
            ("Writing Code from Zero", "/education/year-9-python-foundations/writing-code-from-zero"),
        ),
    ),
    Page(
        target="year-9-python-foundations/writing-code-from-zero.mdx",
        title="Writing Code from Zero",
        description="A guided first coding task focused on output, input, menus, and building confidence from a blank file.",
        order=2,
        page_type="activity",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "practice", "coding"),
        source="level-1-writing-code-from-zero.html",
        intro="This activity is the first structured build from a blank file. It works well after setup and before the Explorer chapters.",
        links_heading="Related Pages",
        links=(
            ("Back to Year 9 Python Foundations", "/education/year-9-python-foundations"),
            ("Python Basics Hub", "/education/python-basics-hub"),
        ),
    ),
    Page(
        target="python-basics-hub.mdx",
        title="Python Basics Hub",
        description="The main chapter hub for the Explorer sequence, covering print, variables, input, conditionals, loops, lists, functions, and debugging.",
        order=3,
        page_type="reference-hub",
        show_in_index=True,
        featured=False,
        tags=("python", "year-9", "reference", "explorer"),
        source="explorer-python-basics-hub.html",
        intro="The Explorer sequence grows one Python program chapter by chapter. Each page adds one new idea and keeps reusing earlier knowledge so students can see the code evolve over time.",
        links_heading="Chapters",
        links=(
            ("Chapter 1: Your First Python Mission", "/education/python-basics-hub/chapter-1-your-first-python-mission"),
            ("Chapter 2: Printing and Running Code", "/education/python-basics-hub/chapter-2-printing-and-running-code"),
            ("Chapter 3: Variables", "/education/python-basics-hub/chapter-3-variables"),
            ("Chapter 4: Data Types", "/education/python-basics-hub/chapter-4-data-types"),
            ("Chapter 5: Input", "/education/python-basics-hub/chapter-5-input"),
            ("Chapter 6: If Statements", "/education/python-basics-hub/chapter-6-if-statements"),
            ("Chapter 7: Loops", "/education/python-basics-hub/chapter-7-loops"),
            ("Chapter 8: Lists", "/education/python-basics-hub/chapter-8-lists"),
            ("Chapter 9: Functions", "/education/python-basics-hub/chapter-9-functions"),
            ("Chapter 10: Debugging and Errors", "/education/python-basics-hub/chapter-10-debugging-and-errors"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-1-your-first-python-mission.mdx",
        title="Chapter 1: Your First Python Mission",
        description="The opening Explorer chapter, introducing what code is and what it means to make a simple Python program run.",
        order=4,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-01.html",
        intro="Chapter 1 frames Python as a growing mission console: a simple program that becomes more capable as each concept is added.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Next: Chapter 2", "/education/python-basics-hub/chapter-2-printing-and-running-code"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-2-printing-and-running-code.mdx",
        title="Chapter 2: Printing and Running Code",
        description="An introduction to output and the basic cycle of writing, running, and checking Python code.",
        order=5,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-02.html",
        intro="Chapter 2 is where the program starts visibly doing something. It focuses on getting code to run and using output as evidence that the program worked.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 1", "/education/python-basics-hub/chapter-1-your-first-python-mission"),
            ("Next: Chapter 3", "/education/python-basics-hub/chapter-3-variables"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-3-variables.mdx",
        title="Chapter 3: Variables",
        description="A chapter focused on storing information and reusing it clearly through variable names.",
        order=6,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-03.html",
        intro="Chapter 3 introduces variables as named pieces of information the program can remember and display.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 2", "/education/python-basics-hub/chapter-2-printing-and-running-code"),
            ("Next: Chapter 4", "/education/python-basics-hub/chapter-4-data-types"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-4-data-types.mdx",
        title="Chapter 4: Data Types",
        description="An introduction to strings, numbers, and boolean-style thinking through the Explorer build.",
        order=7,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-04.html",
        intro="Chapter 4 expands the program beyond plain text by introducing different kinds of values and what they are useful for.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 3", "/education/python-basics-hub/chapter-3-variables"),
            ("Next: Chapter 5", "/education/python-basics-hub/chapter-5-input"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-5-input.mdx",
        title="Chapter 5: Input",
        description="A chapter on collecting user input, converting types correctly, and using what the user enters.",
        order=8,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-05.html",
        intro="Chapter 5 shifts the program from static output to interaction by collecting and using user input.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 4", "/education/python-basics-hub/chapter-4-data-types"),
            ("Next: Chapter 6", "/education/python-basics-hub/chapter-6-if-statements"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-6-if-statements.mdx",
        title="Chapter 6: If Statements",
        description="An introduction to conditional logic and decision-making in Python programs.",
        order=9,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-06.html",
        intro="Chapter 6 is where the program starts making decisions. It introduces conditions, branches, and indentation discipline.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 5", "/education/python-basics-hub/chapter-5-input"),
            ("Next: Chapter 7", "/education/python-basics-hub/chapter-7-loops"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-7-loops.mdx",
        title="Chapter 7: Loops",
        description="A chapter on repetition, validation, and structuring repeated actions in Python.",
        order=10,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-07.html",
        intro="Chapter 7 introduces repetition, especially for validation and repeated daily logging in the Explorer program.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 6", "/education/python-basics-hub/chapter-6-if-statements"),
            ("Next: Chapter 8", "/education/python-basics-hub/chapter-8-lists"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-8-lists.mdx",
        title="Chapter 8: Lists",
        description="A chapter on storing collections of values and presenting them clearly in summaries.",
        order=11,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-08.html",
        intro="Chapter 8 introduces lists so the Explorer program can store groups of related values and report them back clearly.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 7", "/education/python-basics-hub/chapter-7-loops"),
            ("Next: Chapter 9", "/education/python-basics-hub/chapter-9-functions"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-9-functions.mdx",
        title="Chapter 9: Functions",
        description="A chapter on reducing repetition and structuring code into reusable functions.",
        order=12,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-09.html",
        intro="Chapter 9 focuses on organising repeated behaviour into functions so the program becomes easier to understand and extend.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 8", "/education/python-basics-hub/chapter-8-lists"),
            ("Next: Chapter 10", "/education/python-basics-hub/chapter-10-debugging-and-errors"),
        ),
    ),
    Page(
        target="python-basics-hub/chapter-10-debugging-and-errors.mdx",
        title="Chapter 10: Debugging and Errors",
        description="A chapter on reading tracebacks, isolating problems, and using a reliable debugging routine.",
        order=13,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "chapter", "explorer"),
        source="chapter-10.html",
        intro="Chapter 10 treats errors as information. It gives students a method for debugging instead of random guessing.",
        links_heading="Chapter Navigation",
        links=(
            ("Back to Python Basics Hub", "/education/python-basics-hub"),
            ("Previous: Chapter 9", "/education/python-basics-hub/chapter-9-functions"),
        ),
    ),
    Page(
        target="pet-services-project.mdx",
        title="Pet Services Project",
        description="The main mini-project sequence for planning, building, reviewing, and refining a Python booking system.",
        order=14,
        page_type="project-hub",
        show_in_index=True,
        featured=False,
        tags=("python", "year-9", "project", "pet-services"),
        intro="The Pet Services sequence takes students from planning to implementation, then through feedback and refactoring. It is the main connected project in the Python unit.",
        links_heading="Project Sequence",
        links=(
            ("Project Planning: Audience and Decision Tree", "/education/pet-services-project/planning-and-decision-tree"),
            ("Build the Booking Program", "/education/pet-services-project/build-the-booking-program"),
            ("Worked Solution", "/education/pet-services-project/worked-solution"),
            ("Feedback and Improvement", "/education/pet-services-project/feedback-and-improvement"),
            ("Why Functions Matter", "/education/pet-services-project/why-functions-matter"),
            ("Refactoring with Functions", "/education/pet-services-project/refactoring-with-functions"),
        ),
        note="Use the planning page first, then work through the build and feedback sequence. The later functions pages work best once the original version already makes sense.",
    ),
    Page(
        target="pet-services-project/planning-and-decision-tree.mdx",
        title="Project Planning: Audience and Decision Tree",
        description="A planning page focused on user needs, design choices, and mapping the program’s logic before coding begins.",
        order=15,
        page_type="activity",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "project", "decision-tree"),
        source="pet-services-program-target-audience-and-decision-tree.html",
        intro="This page is the planning foundation of the Pet Services project. It frames the program as a user-focused system rather than a random collection of code.",
        links_heading="Project Navigation",
        links=(
            ("Back to Pet Services Project", "/education/pet-services-project"),
            ("Next: Build the Booking Program", "/education/pet-services-project/build-the-booking-program"),
        ),
    ),
    Page(
        target="pet-services-project/build-the-booking-program.mdx",
        title="Build the Booking Program",
        description="The main build page for turning the Pet Services plan into a working Python booking program.",
        order=16,
        page_type="activity",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "project", "generation"),
        source="pet-services-program-generating.html",
        intro="This page turns the project plan into code. It moves from structured input and decisions toward a usable booking summary.",
        links_heading="Project Navigation",
        links=(
            ("Back to Pet Services Project", "/education/pet-services-project"),
            ("Previous: Planning and Decision Tree", "/education/pet-services-project/planning-and-decision-tree"),
            ("Next: Worked Solution", "/education/pet-services-project/worked-solution"),
        ),
    ),
    Page(
        target="pet-services-project/worked-solution.mdx",
        title="Worked Solution",
        description="A teacher-style walkthrough showing how the planning and decision tree translate into a complete Pet Services solution.",
        order=17,
        page_type="worked-example",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "project", "worked-example"),
        source="pet-services-program-a-worked-solution.html",
        intro="This worked example shows how the planning decisions, validation logic, and structure all connect in a full version of the program.",
        links_heading="Project Navigation",
        links=(
            ("Back to Pet Services Project", "/education/pet-services-project"),
            ("Previous: Build the Booking Program", "/education/pet-services-project/build-the-booking-program"),
            ("Next: Feedback and Improvement", "/education/pet-services-project/feedback-and-improvement"),
        ),
    ),
    Page(
        target="pet-services-project/feedback-and-improvement.mdx",
        title="Feedback and Improvement",
        description="A structured review page for testing the program, giving useful feedback, and identifying concrete improvements.",
        order=18,
        page_type="activity",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "project", "feedback"),
        source="pet-services-program-feedback.html",
        intro="This stage focuses on review and improvement rather than new syntax. The goal is to make the program clearer, stronger, and easier to maintain.",
        links_heading="Project Navigation",
        links=(
            ("Back to Pet Services Project", "/education/pet-services-project"),
            ("Previous: Worked Solution", "/education/pet-services-project/worked-solution"),
            ("Next: Why Functions Matter", "/education/pet-services-project/why-functions-matter"),
        ),
    ),
    Page(
        target="pet-services-project/why-functions-matter.mdx",
        title="Why Functions Matter",
        description="An explanation of why functions exist and how they improve structure, reuse, and readability in the Pet Services project.",
        order=19,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "functions", "project"),
        source="pet-services-program-what-is-a-function-and-why-does-it-exist.html",
        intro="This page introduces functions as a design tool, not just a syntax trick. It explains the problem functions solve before asking students to refactor.",
        links_heading="Project Navigation",
        links=(
            ("Back to Pet Services Project", "/education/pet-services-project"),
            ("Previous: Feedback and Improvement", "/education/pet-services-project/feedback-and-improvement"),
            ("Next: Refactoring with Functions", "/education/pet-services-project/refactoring-with-functions"),
        ),
    ),
    Page(
        target="pet-services-project/refactoring-with-functions.mdx",
        title="Refactoring with Functions",
        description="A follow-up page on turning repeated code into reusable functions inside the Pet Services project.",
        order=20,
        page_type="lesson",
        show_in_index=False,
        featured=False,
        tags=("python", "year-9", "functions", "refactoring"),
        source="pet-services-program-refactoring-our-pet-booking-system-using-functions.html",
        intro="This page applies the functions idea directly to the existing project, showing how repeated logic can be broken into smaller reusable parts.",
        links_heading="Project Navigation",
        links=(
            ("Back to Pet Services Project", "/education/pet-services-project"),
            ("Previous: Why Functions Matter", "/education/pet-services-project/why-functions-matter"),
        ),
    ),
    Page(
        target="python-reference.mdx",
        title="Programming Reference",
        description="A broad Python reference page covering core syntax, structures, common errors, and worked examples.",
        order=21,
        page_type="reference",
        show_in_index=True,
        featured=False,
        tags=("python", "year-9", "reference", "syntax"),
        source="python-reference-wiki.html",
        intro="Use this as a lookup page when students need examples, reminders, or a more complete reference than the chapter sequence provides.",
        links_heading="See Also",
        links=(
            ("Python Basics Hub", "/education/python-basics-hub"),
            ("Writing Good Code", "/education/writing-good-code"),
        ),
    ),
    Page(
        target="algorithms-with-mermaid.mdx",
        title="Algorithms with Mermaid",
        description="A practical guide to building algorithm flowcharts with Mermaid before translating them into code.",
        order=22,
        page_type="guide",
        show_in_index=True,
        featured=False,
        tags=("python", "year-9", "algorithms", "mermaid"),
        source="mermaid-live-building-an-algorithm-flow-chart.html",
        intro="This guide turns flowcharting into a lightweight, repeatable planning step. It works especially well before project pages that rely on decision trees.",
        links_heading="Related Pages",
        links=(
            ("Pet Services Project", "/education/pet-services-project"),
            ("Project Planning: Audience and Decision Tree", "/education/pet-services-project/planning-and-decision-tree"),
        ),
    ),
    Page(
        target="writing-good-code.mdx",
        title="Writing Good Code",
        description="An introduction to clean coding habits, naming, readability, and deliberate structure for beginners.",
        order=23,
        page_type="lesson",
        show_in_index=True,
        featured=False,
        tags=("python", "year-9", "programming-foundations", "style"),
        source="writing-good-code-an-introduction.html",
        intro="This page focuses on readable code and good habits early, before students normalise messy naming, unclear structure, or random fixes.",
        links_heading="Related Pages",
        links=(
            ("Year 9 Python Foundations", "/education/year-9-python-foundations"),
            ("Programming Reference", "/education/python-reference"),
        ),
    ),
    Page(
        target="install-python-with-thonny.mdx",
        title="Install Python with Thonny",
        description="A setup guide for getting Thonny installed and ready so students can start coding with a known-good environment.",
        order=24,
        page_type="setup-guide",
        show_in_index=True,
        featured=False,
        tags=("python", "year-9", "setup", "thonny"),
        source="get-python-ready-install-thonny.html",
        intro="This setup guide gives students a clean path into the unit without requiring a full Python toolchain discussion on day one.",
        links_heading="Related Pages",
        links=(
            ("Year 9 Python Foundations", "/education/year-9-python-foundations"),
            ("Writing Code from Zero", "/education/year-9-python-foundations/writing-code-from-zero"),
        ),
        note="Download links now point to the public Thonny site rather than a bundled installer archive.",
    ),
]


def mdx_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def import_path(target: str) -> str:
    depth = len(Path(target).parts) - 1
    prefix = "../" * (depth + 2)
    return f"{prefix}components/education/ImportedHtml.astro"


def build_page(page: Page) -> str:
    tags = ", ".join(f'"{tag}"' for tag in page.tags)
    frontmatter = textwrap.dedent(
        f"""\
        ---
        title: "{mdx_escape(page.title)}"
        description: "{mdx_escape(page.description)}"
        pubDate: 2026-03-04
        updatedDate: 2026-03-04
        draft: false
        level: "year-9"
        subject: "digital-technologies"
        order: {page.order}
        type: "{page.page_type}"
        showInIndex: {"true" if page.show_in_index else "false"}
        featured: {"true" if page.featured else "false"}
        headerStyle: "plain"
        tags: [{tags}]
        ---
        """
    )

    parts: list[str] = [frontmatter.strip(), ""]

    if page.source:
        parts.extend([f'import ImportedHtml from "{import_path(page.target)}";', ""])

    if page.intro:
        parts.extend([page.intro, ""])

    if page.links_heading and page.links:
        parts.append(f"## {page.links_heading}")
        parts.append("")
        for label, href in page.links:
            parts.append(f"- [{label}]({href})")
        parts.append("")

    if page.note:
        parts.extend([f"> {page.note}", ""])

    if page.source:
        parts.extend([f'<ImportedHtml source="{page.source}" />', ""])

    return "\n".join(parts).rstrip() + "\n"


def main() -> None:
    for page in PAGES:
        destination = OUTPUT_DIR / page.target
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(build_page(page), encoding="utf-8")


if __name__ == "__main__":
    main()
