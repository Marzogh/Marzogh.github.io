export interface Year9DigitechResource {
  slug: string;
  sourceSlug?: string;
  title: string;
  description: string;
  resourceType: string;
  unit?: 'unit-1' | 'unit-2' | 'shared';
  audience?: 'student' | 'teacher' | 'both';
  tags: string[];
  sequence?: number;
  showInLanding?: boolean;
  featured?: boolean;
}

export interface Year9DigitechGroup {
  title: string;
  description?: string;
  slugs: string[];
}

export interface Year9DigitechUnitMap {
  slug: 'unit-1' | 'unit-2';
  href: string;
  title: string;
  strapline: string;
  description: string;
  groups: Year9DigitechGroup[];
}

const unit1Base = 'digital-technologies/year-9/unit-1';
const unit2Base = 'digital-technologies/year-9/unit-2';
const sharedBase = 'digital-technologies/year-9/shared';

export const YEAR9_DIGITECH_RESOURCES: Year9DigitechResource[] = [
  {
    slug: 'digital-technologies/year-9',
    title: 'Year 9 Digital Technologies',
    description: 'The full Year 9 Digital Technologies course, bringing together Python, projects, robotics, physical computing, reference material, and assessment sequences.',
    resourceType: 'course-overview',
    audience: 'both',
    tags: ['digital-technologies', 'year-9', 'course'],
    showInLanding: true,
    featured: true,
  },
  {
    slug: `${unit1Base}`,
    title: 'Unit 1: All About Python',
    description: 'The Unit 1 sequence for Python foundations, exploratory chapters, project work, references, and mini-games.',
    resourceType: 'unit-overview',
    unit: 'unit-1',
    audience: 'both',
    tags: ['digital-technologies', 'year-9', 'python', 'unit-1'],
    showInLanding: true,
    featured: true,
  },
  {
    slug: `${unit2Base}`,
    title: 'Unit 2: Making Python Interact with the Real World',
    description: 'The Unit 2 robotics and physical computing sequence, including weekly lessons, VEX references, and assessment materials.',
    resourceType: 'unit-overview',
    unit: 'unit-2',
    audience: 'both',
    tags: ['digital-technologies', 'year-9', 'robotics', 'unit-2'],
    showInLanding: true,
    featured: true,
  },
  { slug: `${unit1Base}/welcome`, sourceSlug: 'welcome-to-unit-1-all-about-python.html', title: 'Welcome to Unit 1', description: 'The opening page for Unit 1, introducing the Python pathway and how the term fits together.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'unit-1', 'welcome'], sequence: 10 },
  { slug: `${unit1Base}/setup/install-thonny`, sourceSlug: '2-1-get-python-ready-install-thonny.html', title: 'Get Python Ready: Install Thonny', description: 'A setup guide for getting Thonny installed and ready for the course.', resourceType: 'setup-guide', unit: 'unit-1', audience: 'both', tags: ['python', 'setup', 'thonny'], sequence: 20, showInLanding: true },
  { slug: `${unit1Base}/foundations/writing-good-code`, sourceSlug: 'writing-good-code-an-introduction.html', title: 'How to Think Like a Programmer', description: 'A foundation page on readable code, naming, structure, and deliberate problem-solving habits.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'style', 'foundations'], sequence: 30, showInLanding: true },
  { slug: `${unit1Base}/assessments/python-digital-system`, sourceSlug: 'assignment-term-1-assignment-python-digital-system.html', title: 'Term 1 Assignment: Python Digital System', description: 'The main Unit 1 assessment brief for the Python Digital System project.', resourceType: 'assessment', unit: 'unit-1', audience: 'both', tags: ['python', 'assessment', 'unit-1'], sequence: 40 },
  { slug: `${unit1Base}/explorer`, sourceSlug: 'explorer-python-basics-hub.html', title: 'Explorer: Python Basics Hub', description: 'The central hub for the Python Explorer chapter sequence.', resourceType: 'reference', unit: 'unit-1', audience: 'both', tags: ['python', 'explorer', 'hub'], sequence: 50 },
  { slug: `${unit1Base}/explorer/chapter-01`, sourceSlug: 'chapter-01.html', title: 'Chapter 01', description: 'The first Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 60 },
  { slug: `${unit1Base}/explorer/chapter-02`, sourceSlug: 'chapter-02.html', title: 'Chapter 02', description: 'The second Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 70 },
  { slug: `${unit1Base}/explorer/chapter-03`, sourceSlug: 'chapter-03.html', title: 'Chapter 03', description: 'The third Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 80 },
  { slug: `${unit1Base}/explorer/chapter-04`, sourceSlug: 'chapter-04.html', title: 'Chapter 04', description: 'The fourth Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 90 },
  { slug: `${unit1Base}/explorer/chapter-05`, sourceSlug: 'chapter-05.html', title: 'Chapter 05', description: 'The fifth Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 100 },
  { slug: `${unit1Base}/explorer/chapter-06`, sourceSlug: 'chapter-06.html', title: 'Chapter 06', description: 'The sixth Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 110 },
  { slug: `${unit1Base}/explorer/chapter-07`, sourceSlug: 'chapter-07.html', title: 'Chapter 07', description: 'The seventh Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 120 },
  { slug: `${unit1Base}/explorer/chapter-08`, sourceSlug: 'chapter-08.html', title: 'Chapter 08', description: 'The eighth Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 130 },
  { slug: `${unit1Base}/explorer/chapter-09`, sourceSlug: 'chapter-09.html', title: 'Chapter 09', description: 'The ninth Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 140 },
  { slug: `${unit1Base}/explorer/chapter-10`, sourceSlug: 'chapter-10.html', title: 'Chapter 10', description: 'The tenth Explorer chapter in the Unit 1 Python sequence.', resourceType: 'chapter', unit: 'unit-1', audience: 'both', tags: ['python', 'chapter', 'explorer'], sequence: 150 },
  { slug: `${unit1Base}/projects/pet-services/decision-tree`, sourceSlug: 'pet-services-program-target-audience-decision-tree.html', title: 'Pet Services: Target Audience and Decision Tree', description: 'Plan the Pet Services project by identifying audience needs and mapping decision logic.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project', 'pet-services'], sequence: 160 },
  { slug: `${unit1Base}/projects/pet-services/generating`, sourceSlug: 'pet-services-program-generating.html', title: 'Pet Services: Generating', description: 'Build the core Pet Services program from the planning work.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project', 'pet-services'], sequence: 170 },
  { slug: `${unit1Base}/projects/pet-services/feedback`, sourceSlug: 'pet-services-program-feedback.html', title: 'Pet Services: Feedback', description: 'Review and improve the Pet Services program through structured testing and feedback.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project', 'pet-services'], sequence: 180 },
  { slug: `${unit1Base}/projects/pet-services/worked-solution`, sourceSlug: 'pet-services-program-a-worked-solution.html', title: 'Pet Services: Worked Solution', description: 'A worked solution for the Pet Services project.', resourceType: 'worked-example', unit: 'unit-1', audience: 'teacher', tags: ['python', 'project', 'pet-services'], sequence: 190 },
  { slug: `${unit1Base}/projects/pet-services/why-functions-exist`, sourceSlug: 'pet-services-program-what-is-a-function-and-why-does-it-exist.html', title: 'Pet Services: What is a Function and Why Does it Exist?', description: 'Introduce functions through the Pet Services project context.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'functions', 'pet-services'], sequence: 200 },
  { slug: `${unit1Base}/projects/pet-services/refactoring-with-functions`, sourceSlug: 'pet-services-program-refactoring-our-pet-booking-system-using-functions.html', title: 'Pet Services: Refactoring Using Functions', description: 'Refactor the Pet Services program into clearer reusable functions.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'functions', 'pet-services'], sequence: 210 },
  { slug: `${unit1Base}/projects/pet-services/making-and-reading-lists`, sourceSlug: 'pet-services-program-making-and-reading-lists.html', title: 'Pet Services: Making and Reading Lists', description: 'Extend the Pet Services program with list-based program flow.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'lists', 'pet-services'], sequence: 220 },
  { slug: `${unit1Base}/projects/shopping-list/decision-trees-and-features`, sourceSlug: 'shopping-list-decision-trees-additional-features.html', title: 'Shopping List: Decision Trees and Additional Features', description: 'Use the shopping list project to plan branching logic and extra features.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project', 'shopping-list'], sequence: 230 },
  { slug: `${unit1Base}/projects/shopping-list/generating`, sourceSlug: 'shopping-list-generating.html', title: 'Shopping List: Generating', description: 'Build the shopping list project from its planning work.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project', 'shopping-list'], sequence: 240 },
  { slug: `${unit1Base}/projects/shopping-list/generating-cont`, sourceSlug: 'shopping-list-generating-cont.html', title: 'Shopping List: Generating cont.', description: 'Continue and extend the shopping list project.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project', 'shopping-list'], sequence: 250 },
  { slug: `${unit1Base}/mini-games/dice-roll-guesser`, sourceSlug: 'mini-game-dice-roll-guesser.html', title: 'Mini Game: Dice Roll Guesser', description: 'A small practice game for conditional logic and randomness.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'mini-game'], sequence: 260 },
  { slug: `${unit1Base}/mini-games/scissors-paper-rock`, sourceSlug: 'mini-game-scissors-paper-rock.html', title: 'Mini Game: Scissors, Paper, Rock', description: 'A simple game used for branching logic and gameplay structure.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'mini-game'], sequence: 270 },
  { slug: `${unit1Base}/mini-games/guess-the-number`, sourceSlug: 'mini-game-guess-the-number.html', title: 'Mini Game: Guess The Number', description: 'A short guessing game used to reinforce loops and conditions.', resourceType: 'lesson', unit: 'unit-1', audience: 'both', tags: ['python', 'mini-game'], sequence: 280 },
  { slug: `${unit1Base}/challenges/week-8-lesson-1`, sourceSlug: 'week-8-lesson-1-challenge.html', title: 'Week 8 Lesson 1 Challenge', description: 'A challenge page for late-unit extension work.', resourceType: 'assessment', unit: 'unit-1', audience: 'both', tags: ['python', 'challenge'], sequence: 290 },
  { slug: `${unit1Base}/challenges/week-9-lesson-1`, sourceSlug: 'week-9-lesson-1-challenge.html', title: 'Week 9 Lesson 1 Challenge', description: 'A challenge page for Unit 1 extension work.', resourceType: 'assessment', unit: 'unit-1', audience: 'both', tags: ['python', 'challenge'], sequence: 300 },
  { slug: `${unit1Base}/challenges/week-9-lesson-1-teacher-solution`, sourceSlug: 'week-9-lesson-1-challenge-teacher-solution.html', title: 'Week 9 Lesson 1 Teacher Solution', description: 'Teacher solution material for the Week 9 Lesson 1 challenge.', resourceType: 'teacher-note', unit: 'unit-1', audience: 'teacher', tags: ['python', 'challenge', 'teacher'], sequence: 310 },
  { slug: `${unit1Base}/challenges/week-9-lesson-2`, sourceSlug: 'week-9-lesson-2-challenge.html', title: 'Week 9 Lesson 2 Challenge', description: 'A second challenge page for Unit 1 extension work.', resourceType: 'assessment', unit: 'unit-1', audience: 'both', tags: ['python', 'challenge'], sequence: 320 },
  { slug: `${unit1Base}/challenges/week-9-lesson-2-teacher-solution`, sourceSlug: 'week-9-lesson-2-challenge-teacher-solution.html', title: 'Week 9 Lesson 2 Teacher Solution', description: 'Teacher solution material for the Week 9 Lesson 2 challenge.', resourceType: 'teacher-note', unit: 'unit-1', audience: 'teacher', tags: ['python', 'challenge', 'teacher'], sequence: 330 },
  { slug: `${unit1Base}/challenges/week-10-lesson-01`, sourceSlug: 'week-10-lesson-01-challenge.html', title: 'Week 10 Lesson 01 Challenge', description: 'A final Unit 1 challenge resource.', resourceType: 'assessment', unit: 'unit-1', audience: 'both', tags: ['python', 'challenge'], sequence: 340 },
  { slug: `${unit1Base}/projects/end-of-term-projects`, sourceSlug: 'end-of-term-projects.html', title: 'End of Term Projects', description: 'A round-up page for end-of-term project work.', resourceType: 'project', unit: 'unit-1', audience: 'both', tags: ['python', 'project'], sequence: 350 },
  { slug: `${unit1Base}/reference/python-reference`, sourceSlug: 'python-reference-wiki.html', title: 'Python Reference Wiki', description: 'A broad Python reference page for syntax, structures, and worked examples.', resourceType: 'reference', unit: 'unit-1', audience: 'both', tags: ['python', 'reference'], sequence: 360, showInLanding: true },
  { slug: `${unit1Base}/reference/writing-code-from-zero`, sourceSlug: 'level-1-writing-code-from-zero.html', title: 'Level 1: Writing Code from Zero', description: 'A guided coding task for students starting from a blank file.', resourceType: 'reference', unit: 'unit-1', audience: 'both', tags: ['python', 'reference'], sequence: 370 },
  { slug: `${unit1Base}/reference/images-are-text`, sourceSlug: 'images-are-text.html', title: 'Images are text?!', description: 'A support page connecting digital media ideas to textual representation.', resourceType: 'reference', unit: 'unit-1', audience: 'both', tags: ['digital-media', 'reference'], sequence: 380 },
  { slug: `${unit1Base}/reference/images-are-text-2`, sourceSlug: 'images-are-text-2.html', title: 'Images are text?! 2', description: 'A continuation of the digital representation support material.', resourceType: 'reference', unit: 'unit-1', audience: 'both', tags: ['digital-media', 'reference'], sequence: 390 },
  { slug: `${unit1Base}/reference/mermaid-live-algorithm-guide`, sourceSlug: 'mermaid-live-building-an-algorithm-flow-chart.html', title: 'Mermaid.live Algorithm Guide', description: 'A guide to planning algorithms with Mermaid before turning them into code.', resourceType: 'reference', unit: 'unit-1', audience: 'both', tags: ['algorithms', 'reference'], sequence: 400 },
  { slug: `${unit1Base}/reference/sandbox-for-html-testing`, sourceSlug: 'sandbox-for-html-testing.html', title: 'Sandbox for HTML Testing', description: 'A support page retained from the course materials for HTML experimentation.', resourceType: 'reference', unit: 'unit-1', audience: 'teacher', tags: ['html', 'sandbox'], sequence: 410 },
  { slug: `${unit2Base}/welcome`, sourceSlug: 'welcome-to-unit-2-making-python-interact-with-the-real-world.html', title: 'Welcome to Unit 2', description: 'The opening page for Unit 2, introducing robotics systems and physical computing.', resourceType: 'lesson', unit: 'unit-2', audience: 'both', tags: ['robotics', 'unit-2', 'welcome'], sequence: 420 },
  { slug: `${unit2Base}/weeks/week-1-meet-the-robot`, sourceSlug: 'week-1-meet-the-robot.html', title: 'Week 1: Meet the Robot', description: 'Build orientation, robot systems, and the first engineering notebook work for Unit 2.', resourceType: 'lesson', unit: 'unit-2', audience: 'both', tags: ['robotics', 'week-1'], sequence: 430 },
  { slug: `${unit2Base}/weeks/week-2-autonomous-movement-and-control`, sourceSlug: 'week-2-autonomous-movement-and-control.html', title: 'Week 2: Autonomous Movement and Control', description: 'The second weekly build sequence for Unit 2 robotics work.', resourceType: 'lesson', unit: 'unit-2', audience: 'both', tags: ['robotics', 'week-2'], sequence: 440 },
  { slug: `${unit2Base}/weeks/week-3-sensors-decisions-and-treasure-hunting`, sourceSlug: 'week-3-sensors-decisions-and-treasure-hunting.html', title: 'Week 3: Sensors, Decisions, and Treasure Hunting', description: 'A Unit 2 lesson focused on sensors, decisions, and treasure-hunting logic.', resourceType: 'lesson', unit: 'unit-2', audience: 'both', tags: ['robotics', 'week-3'], sequence: 450 },
  { slug: `${unit2Base}/weeks/week-4-build-drive-and-test-the-cube-collector-clawbot`, sourceSlug: 'week-4-build-drive-and-test-the-cube-collector-clawbot.html', title: 'Week 4: Build, Drive, and Test the Cube Collector Clawbot', description: 'A Unit 2 lesson focused on building, driving, and testing the Clawbot.', resourceType: 'lesson', unit: 'unit-2', audience: 'both', tags: ['robotics', 'week-4'], sequence: 460 },
  { slug: `${unit2Base}/weeks/week-5-build-drive-and-test-the-cube-collector-clawbot`, sourceSlug: 'week-5-build-drive-and-test-the-cube-collector-clawbot.html', title: 'Week 5: Build, Drive, and Test the Cube Collector Clawbot', description: 'A continuation of the Unit 2 build-and-test sequence.', resourceType: 'lesson', unit: 'unit-2', audience: 'both', tags: ['robotics', 'week-5'], sequence: 470 },
  { slug: `${unit2Base}/assessment/space-rover-design`, sourceSlug: 'assignment-term-2-assignment-space-rover-design.html', title: 'Term 2 Assignment: Space Rover Design', description: 'The main Unit 2 engineering design assessment brief.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment', 'space-rover'], sequence: 480 },
  { slug: `${unit2Base}/assessment/rover-prototype-space-robot-inspiration`, sourceSlug: 'rover-prototype-space-robot-inspiration.html', title: 'Rover Prototype: Space Robot Inspiration', description: 'A supporting page for rover prototype planning and inspiration.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'space-rover', 'reference'], sequence: 490 },
  { slug: `${unit2Base}/assessment/engineering-portfolio-starter-pack`, sourceSlug: 'engineering-portfolio-starter-pack.html', title: 'Engineering Portfolio Starter Pack', description: 'The portfolio starter pack for recording and presenting Unit 2 engineering evidence.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'portfolio', 'assessment'], sequence: 500 },
  { slug: `${unit2Base}/assessment/lesson-by-lesson-engineering-entries`, sourceSlug: 'lesson-by-lesson-engineering-entries.html', title: 'Lesson-by-Lesson Engineering Entries', description: 'A support page for structuring engineering portfolio entries through Unit 2.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'portfolio', 'reference'], sequence: 510 },
  { slug: `${unit2Base}/assessment/how-to-use-your-engineering-notebook`, sourceSlug: 'how-to-use-your-engineering-notebook.html', title: 'How to Use Your Engineering Notebook', description: 'Guidance for keeping an effective engineering notebook through Unit 2.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'portfolio', 'reference'], sequence: 520 },
  { slug: `${unit2Base}/assessment/lesson-1`, sourceSlug: 'assessment-2-lesson-1.html', title: 'Assessment 2 Lesson 1', description: 'The first lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 530 },
  { slug: `${unit2Base}/assessment/lesson-2`, sourceSlug: 'assessment-2-lesson-2.html', title: 'Assessment 2 Lesson 2', description: 'The second lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 540 },
  { slug: `${unit2Base}/assessment/lesson-3`, sourceSlug: 'assessment-2-lesson-3.html', title: 'Assessment 2 Lesson 3', description: 'The third lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 550 },
  { slug: `${unit2Base}/assessment/lesson-4`, sourceSlug: 'assessment-2-lesson-4.html', title: 'Assessment 2 Lesson 4', description: 'The fourth lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 560 },
  { slug: `${unit2Base}/assessment/lesson-5`, sourceSlug: 'assessment-2-lesson-5.html', title: 'Assessment 2 Lesson 5', description: 'The fifth lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 570 },
  { slug: `${unit2Base}/assessment/lesson-6`, sourceSlug: 'assessment-2-lesson-6.html', title: 'Assessment 2 Lesson 6', description: 'The sixth lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 580 },
  { slug: `${unit2Base}/assessment/lesson-7`, sourceSlug: 'assessment-2-lesson-7.html', title: 'Assessment 2 Lesson 7', description: 'The seventh lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 590 },
  { slug: `${unit2Base}/assessment/lesson-8`, sourceSlug: 'assessment-2-lesson-8.html', title: 'Assessment 2 Lesson 8', description: 'The eighth lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 600 },
  { slug: `${unit2Base}/assessment/lesson-9`, sourceSlug: 'assessment-2-lesson-9.html', title: 'Assessment 2 Lesson 9', description: 'The ninth lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 610 },
  { slug: `${unit2Base}/assessment/lesson-10`, sourceSlug: 'assessment-2-lesson-10.html', title: 'Assessment 2 Lesson 10', description: 'The tenth lesson in the Unit 2 assessment sequence.', resourceType: 'assessment', unit: 'unit-2', audience: 'both', tags: ['robotics', 'assessment'], sequence: 620 },
  { slug: `${unit2Base}/reference/using-vexcode`, sourceSlug: 'using-vexcode.html', title: 'Using VEXcode', description: 'A reference page for setting up and working with VEXcode.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'vexcode', 'reference'], sequence: 630 },
  { slug: `${unit2Base}/reference/blocks-api`, sourceSlug: 'blocks-api.html', title: 'Blocks API', description: 'A reference page for the VEX blocks API used in Unit 2.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'blocks-api', 'reference'], sequence: 640 },
  { slug: `${unit2Base}/reference/python-api`, sourceSlug: 'python-api.html', title: 'Python API', description: 'A reference page for the VEX Python API used in Unit 2.', resourceType: 'reference', unit: 'unit-2', audience: 'both', tags: ['robotics', 'python-api', 'reference'], sequence: 650 },
  { slug: `${unit2Base}/teacher/teacher-reference-page`, sourceSlug: 'teacher-reference-page.html', title: 'Teacher Reference Page', description: 'A teacher-facing support page for Unit 2 delivery.', resourceType: 'teacher-note', unit: 'unit-2', audience: 'teacher', tags: ['robotics', 'teacher', 'reference'], sequence: 660 },
];

export const YEAR9_DIGITECH_BY_SLUG = new Map(YEAR9_DIGITECH_RESOURCES.map((resource) => [resource.slug, resource]));
export const EDUCATION_QLEARN_ROUTE_MAP: Record<string, string> = Object.fromEntries(
  YEAR9_DIGITECH_RESOURCES.filter((resource) => resource.sourceSlug).map((resource) => {
    if (resource.sourceSlug === 'welcome-to-unit-1-all-about-python.html') {
      return [resource.sourceSlug, `/education/${unit1Base}`];
    }
    if (resource.sourceSlug === 'welcome-to-unit-2-making-python-interact-with-the-real-world.html') {
      return [resource.sourceSlug, `/education/${unit2Base}`];
    }
    return [resource.sourceSlug as string, `/education/${resource.slug}`];
  })
);

export const YEAR9_DIGITECH_UNITS: Year9DigitechUnitMap[] = [
  {
    slug: 'unit-1',
    href: `/education/${unit1Base}`,
    title: 'Unit 1: All About Python',
    strapline: 'Python foundations, projects, mini-games, and reference.',
    description: 'Start with setup and programming habits, move through the Explorer chapters, then branch into project work, challenges, and reference material.',
    groups: [
      {
        title: 'Start here',
        description: 'First stops for the term.',
        slugs: [
          `${unit1Base}/welcome`,
          `${unit1Base}/setup/install-thonny`,
          `${unit1Base}/foundations/writing-good-code`,
          `${unit1Base}/assessments/python-digital-system`,
        ],
      },
      {
        title: 'Python Explorer',
        description: 'The core chapter sequence.',
        slugs: [
          `${unit1Base}/explorer`,
          `${unit1Base}/explorer/chapter-01`,
          `${unit1Base}/explorer/chapter-02`,
          `${unit1Base}/explorer/chapter-03`,
          `${unit1Base}/explorer/chapter-04`,
          `${unit1Base}/explorer/chapter-05`,
          `${unit1Base}/explorer/chapter-06`,
          `${unit1Base}/explorer/chapter-07`,
          `${unit1Base}/explorer/chapter-08`,
          `${unit1Base}/explorer/chapter-09`,
          `${unit1Base}/explorer/chapter-10`,
        ],
      },
      {
        title: 'Project: Pet Services',
        slugs: [
          `${unit1Base}/projects/pet-services/decision-tree`,
          `${unit1Base}/projects/pet-services/generating`,
          `${unit1Base}/projects/pet-services/feedback`,
          `${unit1Base}/projects/pet-services/worked-solution`,
          `${unit1Base}/projects/pet-services/why-functions-exist`,
          `${unit1Base}/projects/pet-services/refactoring-with-functions`,
          `${unit1Base}/projects/pet-services/making-and-reading-lists`,
        ],
      },
      {
        title: 'Project: Shopping List',
        slugs: [
          `${unit1Base}/projects/shopping-list/decision-trees-and-features`,
          `${unit1Base}/projects/shopping-list/generating`,
          `${unit1Base}/projects/shopping-list/generating-cont`,
        ],
      },
      {
        title: 'Mini-games and extension',
        slugs: [
          `${unit1Base}/mini-games/dice-roll-guesser`,
          `${unit1Base}/mini-games/scissors-paper-rock`,
          `${unit1Base}/mini-games/guess-the-number`,
          `${unit1Base}/challenges/week-8-lesson-1`,
          `${unit1Base}/challenges/week-9-lesson-1`,
          `${unit1Base}/challenges/week-9-lesson-1-teacher-solution`,
          `${unit1Base}/challenges/week-9-lesson-2`,
          `${unit1Base}/challenges/week-9-lesson-2-teacher-solution`,
          `${unit1Base}/challenges/week-10-lesson-01`,
          `${unit1Base}/projects/end-of-term-projects`,
        ],
      },
      {
        title: 'Reference',
        slugs: [
          `${unit1Base}/reference/python-reference`,
          `${unit1Base}/reference/writing-code-from-zero`,
          `${unit1Base}/reference/images-are-text`,
          `${unit1Base}/reference/images-are-text-2`,
          `${unit1Base}/reference/mermaid-live-algorithm-guide`,
          `${unit1Base}/reference/sandbox-for-html-testing`,
        ],
      },
    ],
  },
  {
    slug: 'unit-2',
    href: `/education/${unit2Base}`,
    title: 'Unit 2: Making Python Interact with the Real World',
    strapline: 'Robotics builds, assessment sequence, and VEX reference.',
    description: 'Move from robot onboarding into weekly builds, then into the rover design assessment sequence, portfolio support, and platform references.',
    groups: [
      {
        title: 'Start here',
        slugs: [`${unit2Base}/welcome`],
      },
      {
        title: 'Weekly build sequence',
        slugs: [
          `${unit2Base}/weeks/week-1-meet-the-robot`,
          `${unit2Base}/weeks/week-2-autonomous-movement-and-control`,
          `${unit2Base}/weeks/week-3-sensors-decisions-and-treasure-hunting`,
          `${unit2Base}/weeks/week-4-build-drive-and-test-the-cube-collector-clawbot`,
          `${unit2Base}/weeks/week-5-build-drive-and-test-the-cube-collector-clawbot`,
        ],
      },
      {
        title: 'Assessment: Space Rover Design',
        slugs: [
          `${unit2Base}/assessment/space-rover-design`,
          `${unit2Base}/assessment/rover-prototype-space-robot-inspiration`,
          `${unit2Base}/assessment/engineering-portfolio-starter-pack`,
          `${unit2Base}/assessment/lesson-by-lesson-engineering-entries`,
          `${unit2Base}/assessment/how-to-use-your-engineering-notebook`,
        ],
      },
      {
        title: 'Assessment lesson sequence',
        slugs: [
          `${unit2Base}/assessment/lesson-1`,
          `${unit2Base}/assessment/lesson-2`,
          `${unit2Base}/assessment/lesson-3`,
          `${unit2Base}/assessment/lesson-4`,
          `${unit2Base}/assessment/lesson-5`,
          `${unit2Base}/assessment/lesson-6`,
          `${unit2Base}/assessment/lesson-7`,
          `${unit2Base}/assessment/lesson-8`,
          `${unit2Base}/assessment/lesson-9`,
          `${unit2Base}/assessment/lesson-10`,
        ],
      },
      {
        title: 'VEX and coding reference',
        slugs: [
          `${unit2Base}/reference/using-vexcode`,
          `${unit2Base}/reference/blocks-api`,
          `${unit2Base}/reference/python-api`,
        ],
      },
      {
        title: 'Teacher reference',
        slugs: [`${unit2Base}/teacher/teacher-reference-page`],
      },
    ],
  },
];

export const YEAR9_DIGITECH_SUBJECTS = [
  { href: '/education/digital-technologies', label: 'Digital Technologies' },
  { href: '/education/biology', label: 'Biology' },
  { href: '/education/mathematics', label: 'Mathematics' },
];
