import type { Personality } from "./personality";

export const translations = {
  en: {
    // Portal
    "portal.badge": "AI-POWERED PORTAL",
    "portal.hero.title1": "Your gateway to the AI World",
    "portal.hero.title2": "",
    "portal.hero.gateway": "Your Gateway to",
    "portal.hero.ai_services": "AI Services",
    "portal.hero.subtitle":
      "Discover AI tools, connect with services, and let Destiny streamline your workflow.",
    "portal.destiny.description_short": "EGT AI Assistant",
    "portal.services.tools_desc": "Collection of useful tools",
    "portal.services.request_desc": "For your specific use-case",
    "portal.search.placeholder":
      "Search chats, documents, or ask Destiny anything...",
    "portal.destiny.name": "Destiny",
    "portal.destiny.description":
      "Your AI Assistant — ready to help you work smarter",
    "portal.destiny.cta": "Open Chatbot",
    "portal.featured": "Featured Links",
    "portal.featured.getting_started": "Getting Started with Destiny",
    "portal.featured.getting_started_desc":
      "Learn how to make the most of your AI assistant",
    "portal.featured.jira": "Jira Dashboard",
    "portal.featured.jira_desc": "Track your tasks and project progress",
    "portal.featured.confluence": "Confluence Wiki",
    "portal.featured.confluence_desc":
      "Access shared knowledge and documentation",
    "portal.featured.service_desk": "Service Desk",
    "portal.featured.service_desk_desc": "Submit requests and track tickets",
    "portal.news": "News & Updates",
    "portal.news.mcp": "New MCP Integrations",
    "portal.news.mcp_desc":
      "Access Teams, Outlook, Jira & Confluence directly through Destiny.",
    "portal.news.launch": "Portal Launch",
    "portal.news.launch_desc":
      "Your new AI Center hub is live. Explore tools and resources in one place.",
    "portal.teams.title": "Join us on MS Teams",
    "portal.teams.desc": "Connect with the AI Center team",
    "portal.teams.cta": "Join Channel",
    "portal.footer.division": "Scientific Modelling Division",
    "portal.footer.desc": "EGT Internal Division AI Portal",
    "portal.footer.version_label": "Version",
    "portal.footer.button_guides": "Guides",
    "portal.footer.button_changelog": "Changelog",
    "portal.footer.button_contact": "Contact",
    "portal.footer.toast_coming_soon": "This link is coming soon.",
    "portal.gateway": "Your Gateway to AI Services",
    "portal.sidebar.ai_portal": "AI Portal",
    "portal.sidebar.egt_digital": "EGT Digital",
    "portal.news_ticker": "News: Meet MisterY - Your New AI Companion!",
    "portal.search_placeholder": "Search...",
    "sidebar.blog": "Blog",

    // Changelog
    "changelog.title": "Changelog",
    "changelog.description":
      "Stay up to date with the latest improvements and new features in Destiny AI.",
    "changelog.version": "Version",
    "changelog.release_date": "Released",
    "changelog.features": "Features",
    "changelog.improvements": "Improvements",
    "changelog.bug_fixes": "Bug Fixes",
    "changelog.initial_release": "Initial Release",

    // Portal header
    "header.ai_center": "AI Center",
    "header.ai_center_portal": "AI Center Portal",
    "header.destiny_chatbot": "Destiny Chatbot",
    "header.open_ai": "Open AI assistant",
    "header.new_conversation": "New Conversation",
    "header.start_fresh": "Start a fresh chat",
    "header.search_chats": "Search Chats",
    "header.find_past": "Find past conversations",
    "header.services": "Services",
    "header.request_service": "Request Service",
    "header.confluence_ticketing": "Confluence ticketing",
    "header.resources": "Resources",
    "header.guides": "Guides & Compliance",
    "header.changelog": "Changelog for Jira",
    "header.feedback": "Feedback",
    "header.contact": "Contact Us",
    "header.settings": "Settings",
    "header.sign_out": "Sign out",
    "header.sign_in": "Sign in",
    "header.not_signed_in": "Not signed in",
    "header.signed_in": "Signed in",
    "header.light_mode": "Light mode",
    "header.dark_mode": "Dark mode",
    "header.account": "Account",
    "header.open_menu": "Open menu",
    "header.close_menu": "Close menu",
    "header.user": "User",

    // Chat
    "chat.new_chat": "New Chat",
    "chat.greeting":
      "I'm Destiny, ready to help you work smarter, faster and more efficiently.",
    "chat.compliance1":
      "Destiny is very smart but not perfect – always verify important information.",
    "chat.compliance2":
      "Although Destiny knows Bulgarian, English is the best language for conversations.",
    "chat.compliance3": "Destiny can search the web and access",
    "chat.compliance3_before_last_link": ", and ",
    "chat.compliance3_sentence_end": ".",
    "chat.compliance3_link_aria_confluence":
      "Configure Confluence in Settings under Apps",
    "chat.compliance3_link_aria_jira": "Configure Jira in Settings under Apps",
    "chat.compliance3_link_aria_service_desk":
      "Configure Service Desk in Settings under Apps",
    "chat.terms": "Confluence",
    "chat.and": "Jira",
    "chat.privacy": "Service Desk",
    "chat.placeholder": "Your gateway to the AI World",
    "chat.scenario_busy":
      "Wait for the current reply to finish before starting a scenario.",
    "chat.attach_tools": "Attach & tools",
    "chat.voice": "Voice to text",
    "chat.tone": "Tone & style",
    "chat.personality": "Personality",
    "chat.coming_soon": "Voice-to-text coming soon!",
    "chat.tool_on": "On",
    "chat.remove": "Remove",
    "chat.scenario_clear": "Clear scenario",
    "chat.upload_files_aria": "Upload files",
    "chat.web_search": "Web Search",
    "chat.web_search_pending": "Preparing search…",
    "chat.pdf_empty": "There's nothing to print.",
    "chat.print": "Download as PDF",

    // Tone & style (personality) — must match `Personality` values in lib/personality.ts
    "personality.default.label": "Default",
    "personality.default.description": "Preset style and tone",
    "personality.professional.label": "Professional",
    "personality.professional.description": "Polished and precise",
    "personality.friendly.label": "Friendly",
    "personality.friendly.description": "Warm and chatty",

    // Plus menu tools
    "tool.upload": "Upload",
    "tool.prompt_enhancer": "Prompt Enhancer",
    "tool.image": "Image",
    "tool.deep_search": "Deep Search",
    "tool.jira": "Jira",
    "tool.confluence": "Confluence",

    // Scenario tabs
    "scenario.write": "Write",
    "scenario.think": "Think",
    "scenario.create": "Create",
    "scenario.code": "Code",
    "scenario.improve": "Improve",
    "scenario.plan": "Plan",

    // Tab kickoff — user message when sending from composer with a tab selected (no chip).
    "scenario.tab_kickoff.write":
      "Help me with writing — I need assistance drafting, editing, or refining written content. Please ask about my goal, audience, and tone before creating.",
    "scenario.tab_kickoff.think":
      "Help me think through a topic — I need explanation, analysis, or multiple perspectives. Please ask about my knowledge level and what depth I need.",
    "scenario.tab_kickoff.create":
      "Help me create something new — I need ideas, creative content, scenarios, or analogies. Please ask about my goals and constraints.",
    "scenario.tab_kickoff.code":
      "Help me with code — I need explanation, review, generation, or debugging. Please ask about my experience level and what I'm working with.",
    "scenario.tab_kickoff.improve":
      "Help me improve my work — I need help with self-review, learning design, feedback, or practice. Please ask about my specific situation.",
    "scenario.tab_kickoff.plan":
      "Help me plan — I need roadmaps, agendas, risk assessment, or evaluation criteria. Please ask about my goals, timeline, and stakeholders.",

    // Scenario suggestions — "label (displayText)". Chips show label only; displayText is the full user message with detailed instructions.
    "scenario.write.suggestion1": `Rewrite and edit text (Please rewrite and refine this text with professional polish.
Before you start, ask me:
- What tone do I want? (formal, casual, persuasive, informative)
- What's my primary goal? (clarity, brevity, impact, grammar correction)
- Are there specific sections to focus on or avoid changing?
Then:
- Rewrite the text with improved clarity, flow, and correctness
- Provide 2-3 alternative versions with different tones or structures
- Highlight key changes and explain why they improve the text
- Offer suggestions for further refinement)`,

    "scenario.write.suggestion2": `Generate email template (Please craft a professional, effective email.
Before you start, ask me:
- Who is the recipient? (role, relationship, organization)
- What is the main purpose? (request, update, complaint, inquiry, follow-up)
- What tone is appropriate? (formal, friendly, assertive, diplomatic)
- What are the 2-3 key points that must be included?
- Is there a desired call-to-action?
- Any constraints? (word limit, deadline, sensitive topics)
Then:
- Write a complete email with compelling subject line, professional greeting, clear body, and appropriate closing
- Include a second alternative version with a different approach
- Explain your structural choices and provide follow-up tips)`,

    "scenario.write.suggestion3": `Translate (Please provide accurate, natural translation.
Before you start, ask me:
- What is the source language and target language?
- Should the translation be literal (word-for-word) or natural (idiomatic)?
- Who is the intended audience? (native speakers, learners, specific industry)
- Are there specific terms or phrases that should remain untranslated?
Then:
- Provide the full translation with careful attention to nuance, tone, and cultural context
- Offer alternative phrasings for key sentences if multiple valid interpretations exist
- Highlight any idioms or culturally-specific references that required special handling)`,

    "scenario.write.suggestion4": `Summarize and report (Please distill complex information into clear summaries.
Before you start, ask me:
- What is the intended use? (executive briefing, personal understanding, presentation)
- How detailed should the summary be? (one paragraph, one page, bullet points)
- Who is the audience? (technical, non-technical, executives)
- What aspects are most important? (findings, methodology, recommendations, risks)
Then:
- Provide a structured summary with:
  • TL;DR - one-sentence essence
  • Key Points - 3-7 bullet points with critical information
  • Detailed Summary - expanded paragraphs if requested
  • Action Items or Recommendations if relevant
- Use clear headings and formatting
- Preserve important numbers, dates, and names accurately)`,

    "scenario.think.suggestion1": `Explain complex concepts simply (Please make complex concepts accessible.
Before you start, ask me:
- What is your current knowledge level? (beginner, intermediate, advanced)
- What is your preferred learning style? (step-by-step, big-picture first, analogies, examples)
- What is the context or purpose? (study, work decision, casual curiosity, teaching)
Then:
- Provide a clear, structured explanation with:
  • Simple definition in plain language
  • Key components or principles broken down
  • Concrete examples or analogies tailored to my level
  • Common misconceptions to avoid
  • Optional deeper dive into advanced aspects
- Check for understanding and offer to clarify further)`,

    "scenario.think.suggestion2": `Compare and contrast (Please provide objective, structured comparison.
Before you start, ask me:
- What decision am I trying to make or what question am I answering?
- What criteria matter most? (cost, quality, time, ease of use, scalability, risk)
- Who will be affected by this decision?
- Are there any constraints or deal-breakers?
Then:
- Create a structured comparison with:
  • Overview of each option
  • Side-by-side analysis across stated criteria
  • Pros and cons for each option
  • Trade-offs and key differentiators
  • Contextual recommendation based on priorities
- Present information neutrally and highlight where personal values should drive the choice)`,

    "scenario.think.suggestion3": `Identify logical fallacies (Please critically analyze arguments.
Before you start, ask me:
- What context is this from? (debate, article, decision-making, personal reasoning)
- How deep should the analysis be? (quick check, thorough breakdown, academic-level)
- Am I looking for fallacies only, or also suggestions for strengthening the argument?
Then:
- Provide a structured analysis with:
  • Summary of the argument's main claim and reasoning
  • Identification of any logical fallacies with clear explanations
  • Examples of how the fallacy manifests in the argument
  • Suggestions for reformulating the argument more soundly
  • Note on what makes a stronger version
- Be constructive, not dismissive - the goal is better reasoning)`,

    "scenario.think.suggestion4": `Provide multiple perspectives (Please present balanced, nuanced perspectives.
Before you start, ask me:
- What is my purpose? (understanding, decision-making, debate preparation, teaching)
- How deep should we go? (surface overview, moderate analysis, comprehensive examination)
- Are there specific stakeholder groups or viewpoints I want included?
Then:
- Provide a multi-perspective analysis with:
  • Clear statement of the issue and why it has multiple valid viewpoints
  • 3-5 distinct perspectives with their core reasoning and assumptions
  • Evidence or arguments each perspective uses
  • Strengths and limitations of each viewpoint
  • Areas of common ground or shared values
  • Key trade-offs or tensions between perspectives
- Present each view fairly and charitably, even if controversial)`,

    "scenario.create.suggestion1": `Brainstorm solutions (Please generate diverse, actionable ideas.
Before you start, ask me:
- What is my ultimate goal or desired outcome?
- What constraints exist? (budget, time, resources, technical, organizational)
- Who will be affected by or implement these solutions?
- Have I tried anything already? What worked or didn't?
Then:
- Provide a diverse set of 5-10 ideas organized by:
  • Quick wins - low effort, high impact
  • Strategic options - moderate effort, sustainable
  • Creative approaches - unconventional or innovative
  • Hybrid solutions - combinations of multiple approaches
- For each idea, include: brief description, required resources, potential impact, and key risks
- Help me see possibilities I hadn't considered)`,

    "scenario.create.suggestion2": `Write creative content (Please produce engaging, well-crafted content.
Before you start, ask me:
- What is the purpose or goal? (entertain, persuade, inform, inspire, sell)
- Who is the target audience? (demographics, interests, reading level)
- What tone or style do I want? (humorous, serious, inspirational, casual, formal)
- What length or format do I need? (word count, structure, sections)
- Are there specific themes, messages, or elements that must be included?
Then:
- Create original content that:
  • Opens with a strong hook or introduction
  • Maintains consistent tone and voice throughout
  • Includes vivid details, examples, or storytelling elements
  • Aligns with the stated purpose and audience
  • Follows the requested structure and length
- Offer 1-2 alternative versions or variations if helpful
- Explain key creative choices and suggest ways to adapt or extend)`,

    "scenario.create.suggestion3": `Develop scenarios (Please build realistic, structured scenarios.
Before you start, ask me:
- What is the purpose? (training exercise, strategic planning, risk assessment, role-play)
- Who are the key actors or stakeholders involved?
- What level of realism do I need? (highly realistic, somewhat plausible, hypothetical)
- How detailed should the scenario be? (brief outline, detailed narrative, step-by-step)
Then:
- Build a comprehensive scenario with:
  • Context and background - setting the stage with relevant conditions
  • Key actors and their motivations, goals, and constraints
  • The central situation or challenge that drives the scenario
  • Sequence of events or decision points
  • Multiple possible outcomes or branches based on different choices
  • Implications and lessons for each outcome
- Make the scenario vivid and concrete with specific details)`,

    "scenario.create.suggestion4": `Generate analogies (Please create clear, memorable analogies.
Before you start, ask me:
- Who is my audience? (technical, non-technical, children, executives, general public)
- What domain or context would resonate? (sports, cooking, travel, technology, nature, everyday life)
- What is the purpose? (teaching, persuasion, clarification, memory aid)
- Are there any domains to avoid? (too technical, culturally sensitive, overused)
Then:
- Create 2-3 distinct analogies with:
  • The analogy itself - a clear, concrete comparison
  • Mapping explanation - how each element corresponds to the actual concept
  • Why it works - what makes this analogy effective
  • Limitations - where the analogy breaks down
- Choose analogies that are familiar, vivid, and capture the essential structure)`,

    "scenario.code.suggestion1": `Explain code logic and purpose (Please make code understandable.
Before you start, ask me:
- What is my experience level? (beginner, intermediate, advanced)
- Am I familiar with the programming language and key concepts used?
- What is my goal? (understand for maintenance, learn the language, debug, interview prep)
- Which parts are most confusing? (architecture, specific functions, algorithms, syntax)
Then:
- Provide a structured explanation with:
  • Purpose - what this code does and why it exists
  • High-level architecture - main components and how they interact
  • Step-by-step walkthrough - flow of execution through key functions
  • Key concepts - explanation of important patterns or language features
  • Line-by-line breakdown if requested
  • Examples - sample inputs and expected outputs
- Use clear, accessible language matched to my level
- Include diagrams or visual descriptions if helpful)`,

    "scenario.code.suggestion2": `Suggest code improvements (Please review code for quality and maintainability.
Before you start, ask me:
- What are my goals? (performance, readability, maintainability, security, scalability)
- Are there specific constraints? (API compatibility, limited refactoring time, coding standards)
- What is the context? (production code, prototype, learning project, inherited codebase)
- Are there known issues or pain points I've noticed?
Then:
- Provide a comprehensive code review with:
  • Overall assessment - strengths and key areas for improvement
  • Specific issues organized by priority (critical, high, medium, low)
  • For each issue: description, why it matters, and suggested fix
  • Refactored code examples showing improved versions
  • Best practices and patterns that would benefit this code
  • Trade-offs - when to apply each suggestion
- Focus on changes that provide the most value for effort
- Explain the 'why' behind each recommendation)`,

    "scenario.code.suggestion3": `Generate code templates and documentation (Please create production-ready code templates.
Before you start, ask me:
- What is the specific use case or problem to solve?
- What framework or libraries should be used (or avoided)?
- What features must be included? (error handling, logging, validation, testing, configuration)
- Any coding standards or conventions to follow?
- Do I need examples of how to use or extend the template?
Then:
- Provide a complete, reusable template with:
  • Clean, idiomatic code following language best practices
  • Clear structure with logical separation of concerns
  • Comprehensive comments explaining the 'why' not just the 'what'
  • Error handling and edge case management
  • Configuration options for customization
  • Usage examples showing common scenarios
  • Notes on how to extend or modify for different needs
  • References to relevant documentation
- Make the template copy-paste ready and production-quality)`,

    "scenario.code.suggestion4": `Identify potential bugs (Please help diagnose and fix code issues.
Before you start, ask me:
- What error messages or symptoms am I seeing? (copy exact errors if possible)
- What is the expected behavior vs. actual behavior?
- When did this start happening? (new code, recent changes, always been broken)
- What have I already tried to fix it?
- What is my development environment? (language version, framework, OS, dependencies)
Then:
- Provide systematic debugging support with:
  • Problem analysis - summary of what appears to be wrong and why
  • Root cause identification - the underlying issue
  • Step-by-step fix - specific changes needed with code examples
  • Alternative solutions if multiple approaches exist
  • Prevention tips - how to avoid similar issues in the future
  • Testing suggestions - how to verify the fix works
- If the issue is unclear, guide me through diagnostic steps
- Explain the reasoning behind your diagnosis so I learn debugging skills)`,

    "scenario.improve.suggestion1": `Draft performance self-review (Please help draft a compelling, honest self-review.
Before you start, ask me:
- What is my role and level? (individual contributor, manager, senior, junior)
- What review period does this cover? (quarter, year, project)
- What are my 3-5 biggest achievements or accomplishments?
- What challenges or setbacks did I face and how did I handle them?
- What skills or capabilities did I develop or improve?
- Who will read this? (manager, HR, peer review, promotion committee)
- What tone is appropriate? (humble but confident, data-driven, narrative)
Then:
- Draft a structured self-review with:
  • Opening summary - brief overview of the period and overall performance
  • Key achievements - 3-5 major accomplishments with specific impact and metrics
  • Challenges overcome - difficulties faced and how I addressed them
  • Growth and development - new skills learned, feedback incorporated
  • Contributions to team/organization - collaboration, mentorship, knowledge sharing
  • Future goals - objectives for next period with brief plan
  • Balanced self-assessment - acknowledge areas for growth
- Use concrete examples and quantifiable results
- Maintain a professional, confident tone)`,

    "scenario.improve.suggestion2": `Create learning outcomes (Please define clear, measurable learning outcomes.
Before you start, ask me:
- Who are the learners? (experience level, background, age, profession)
- What is the learning context? (course, workshop, self-study, onboarding, certification)
- What is the duration or scope? (single session, multi-week course, ongoing program)
- What should learners be able to DO after this? (specific skills, behaviors, applications)
- How will learning be assessed or measured? (tests, projects, demonstrations, observations)
Then:
- Create comprehensive learning outcomes with:
  • 4-8 specific, measurable outcomes using action verbs (analyze, create, evaluate, apply)
  • Each outcome structured as: 'By the end, learners will be able to [ACTION] [OBJECT] [CONDITION]'
  • Outcomes organized by cognitive level (knowledge, comprehension, application, analysis, synthesis, evaluation)
  • Success criteria - how to recognize when each outcome is achieved
  • Assessment suggestions - methods to measure each outcome
  • Alignment notes - how outcomes connect to learner needs
- Use Bloom's taxonomy verbs appropriately
- Avoid vague terms like 'understand' or 'know' - focus on observable abilities)`,

    "scenario.improve.suggestion3": `Provide feedback templates (Please provide structured, professional feedback templates.
Before you start, ask me:
- What type of feedback is this? (positive reinforcement, constructive criticism, performance correction, peer feedback)
- Who is giving feedback to whom? (manager to direct report, peer to peer, upward feedback, cross-team)
- What is the specific situation or behavior to address?
- What is my relationship with the recipient? (close, formal, new, strained)
- What is the desired outcome? (behavior change, recognition, development, documentation)
- What tone is appropriate? (supportive, direct, formal, casual, firm)
Then:
- Provide feedback templates and guidance with:
  • Situation-specific template - structured framework tailored to the scenario
  • Opening - how to set a constructive tone and state the purpose
  • Specific observations - language for describing behaviors factually
  • Impact statement - how to articulate the effect of the behavior
  • Request or suggestion - clear, actionable next steps
  • Support offer - how to express willingness to help
  • Example scripts - 2-3 variations showing different phrasings
  • Delivery tips - timing, setting, follow-up recommendations
- Use frameworks like SBI (Situation-Behavior-Impact) or DESC where appropriate
- Balance honesty with empathy)`,

    "scenario.improve.suggestion4": `Role-play conversations (Please facilitate realistic role-play for skill development.
Before you start, ask me:
- What type of conversation do I want to practice? (difficult feedback, negotiation, sales pitch, conflict resolution, interview, performance review)
- What role should you play? (employee, manager, customer, interviewer, colleague, stakeholder)
- What is the scenario context? (specific situation, background, stakes involved)
- What is my experience level with this type of conversation?
- What specific skills do I want to focus on? (active listening, assertiveness, empathy, persuasion, de-escalation)
- How challenging should you be? (supportive, neutral, resistant, hostile)
Then:
- Facilitate the role-play with:
  • Brief scenario setup - context, character background, and relevant details
  • Realistic responses - react authentically with appropriate emotions
  • Adaptive difficulty - adjust based on how I'm doing
  • Pause and reflect - offer to pause for coaching if I seem stuck
  • Post-conversation debrief - what went well, what could be improved, specific suggestions
  • Alternative approaches - show how different tactics might have changed the outcome
  • Key phrases and techniques - language patterns that work well
- Create a safe space to practice and make mistakes
- Balance realism with supportiveness)`,

    "scenario.plan.suggestion1": `Create project roadmaps and outlines (Please create practical, actionable roadmaps.
Before you start, ask me:
- What is the ultimate goal or definition of success?
- What is the timeline? (start date, end date, key milestones or deadlines)
- Who are the key stakeholders and team members involved?
- What resources are available? (budget, people, tools, constraints)
- What are the major deliverables or outcomes expected?
- Are there known dependencies, risks, or constraints?
Then:
- Create a comprehensive roadmap with:
  • Executive summary - brief overview of the project and approach
  • Phases or stages - logical grouping of work with clear objectives
  • Timeline with milestones - key dates, deliverables, and decision points
  • Dependencies - what must happen before other work can begin
  • Resource allocation - who is responsible for what (RACI if helpful)
  • Risk considerations - potential obstacles and mitigation strategies
  • Success metrics - how to measure progress and completion
  • Communication plan - how stakeholders will be updated
- Present the roadmap in a clear, visual-friendly structure
- Balance detail with readability
- Make it actionable enough to guide execution but flexible enough to adapt)`,

    "scenario.plan.suggestion2": `Create meeting agendas (Please create focused, effective meeting agendas.
Before you start, ask me:
- Who are the participants and what are their roles?
- How long is the meeting? (15 min, 30 min, 1 hour, longer)
- What are the 2-4 key outcomes that must be achieved?
- Are there specific topics that must be covered?
- Is any pre-work or preparation required from participants?
Then:
- Create a detailed agenda with:
  • Meeting header - title, date/time, location/link, participants, facilitator, note-taker
  • Meeting objective - one clear sentence stating the purpose
  • Pre-work - any preparation participants should do beforehand
  • Timed agenda items - each topic with: purpose (inform/discuss/decide), time allocation, owner
  • Breaks - for meetings longer than 60 minutes
  • Decision log section - space to record key decisions made
  • Action items section - space to capture next steps with owners and deadlines
  • Follow-up plan - how and when outcomes will be communicated
- Allocate time realistically (including buffer)
- Put high-priority items early
- Specify the desired outcome for each agenda item (not just topics)
- Include tips for keeping the meeting on track and engaged)`,

    "scenario.plan.suggestion3": `Identify risks and mitigations (Please identify, assess, and plan for potential risks.
Before you start, ask me:
- What is the context and scope? (timeline, budget, team size, complexity)
- What is my organization's or team's risk tolerance? (risk-averse, balanced, risk-tolerant)
- What categories of risk should we consider? (technical, financial, operational, reputational, compliance, market, personnel)
- Are there any known concerns or 'elephants in the room'?
- Who are the key stakeholders affected by these risks?
Then:
- Create a comprehensive risk assessment with:
  • Risk identification - 10-20 potential risks across relevant categories
  • Risk analysis for each: description, root causes, triggers/warning signs
  • Likelihood assessment - probability rating (low/medium/high or 1-5 scale)
  • Impact assessment - severity if it occurs (low/medium/high or 1-5 scale)
  • Risk score - combined likelihood × impact for prioritization
  • Mitigation strategies for high-priority risks: prevention actions, contingency plans
  • Risk owners - who is responsible for monitoring and managing each risk
  • Review cadence - how often to reassess risks
- Present risks in a clear priority order
- Focus energy on high-likelihood, high-impact risks
- Balance realism with optimism - don't create paralysis
- Include both threats to mitigate and opportunities to pursue)`,

    "scenario.plan.suggestion4": `Develop evaluation criteria (Please design fair, objective evaluation systems.
Before you start, ask me:
- What is the decision context? (selection, ranking, go/no-go, prioritization, grading)
- Who will use these criteria? (individual, committee, automated system)
- What factors matter most? (cost, quality, fit, risk, innovation, speed)
- Are there any mandatory requirements or deal-breakers?
- How formal does this need to be? (informal checklist, scored rubric, weighted matrix)
Then:
- Create a comprehensive evaluation framework with:
  • Evaluation criteria - 5-10 key factors organized by category (e.g., technical, financial, cultural fit)
  • Criteria definitions - clear description of what each criterion means
  • Weights or priorities - relative importance of each criterion (percentages or ranking)
  • Scoring scale - consistent rating system (1-5, 1-10, poor/excellent) with clear definitions
  • Evaluation rubric - specific indicators or evidence for each score level
  • Mandatory requirements - any pass/fail gates that must be met first
  • Scoring template - worksheet or matrix for consistent evaluation across options
  • Decision rules - how to interpret scores and make the final decision
- Ensure criteria are: specific and measurable, relevant, independent, and complete
- Help me make objective, defensible decisions with reduced bias)`,

    "chat.suggestion.actionable_response":
      "Please provide a professional, structured, and actionable response.",

    // Sidebar
    "sidebar.destiny": "Destiny",
    "sidebar.delete_all": "Delete All Chats",
    "sidebar.navigation": "Navigation",
    "sidebar.changelog": "Changelog",
    "sidebar.knowledge": "Knowledge",
    "sidebar.tools_collection": "Tools Collection",
    "sidebar.request_service": "Request Service",
    "sidebar.api": "API",
    "sidebar.amadeus_whisper": "Amadeus Whisper",
    "sidebar.custom_chatbot": "Custom Chatbot Service",
    "sidebar.guides": "Guides / Compliance",
    "sidebar.back_portal": "Go back to AI Portal",
    "sidebar.delete_all_title": "Delete all chats?",
    "sidebar.delete_all_desc":
      "This action cannot be undone. This will permanently delete all your chats and remove them from our servers.",
    "sidebar.cancel": "Cancel",
    "sidebar.delete_all_confirm": "Delete All",

    "sidebar.today": "Today",
    "sidebar.yesterday": "Yesterday",
    "sidebar.previous_days": "Previous days",
    "sidebar.history": "History",
    "sidebar.full_history": "Full History",

    "sidebar.archived_label": "Archived",
    "sidebar.archived_loading": "Loading archived chats...",
    "sidebar.archived_empty": "No archived chats.",
    "sidebar.restore_action": "Restore back to history",
    "sidebar.toast_archiving_chat": "Archiving chat...",
    "sidebar.toast_chat_archived": "Chat archived",
    "sidebar.toast_archive_failed": "Failed to archive chat",
    "sidebar.toast_restoring_chat": "Restoring chat...",
    "sidebar.toast_chat_restored": "Chat restored",
    "sidebar.toast_restore_failed": "Failed to restore chat",
    "history.action_open": "Open chat",
    "history.action_rename": "Rename",
    "history.action_archive": "Archive",
    "history.action_remove": "Remove",
    "history.rename_placeholder": "Chat title",
    "history.toast_renaming_chat": "Renaming chat...",
    "history.toast_chat_renamed": "Chat renamed",
    "history.toast_rename_failed": "Failed to rename chat",
    "history.toast_archiving_chat": "Archiving chat...",
    "history.toast_chat_archived": "Chat archived",
    "history.toast_archive_failed": "Failed to archive chat",
    "history.toast_deleting_chat": "Deleting chat...",
    "history.toast_chat_deleted": "Chat deleted",
    "history.toast_delete_failed": "Failed to delete chat",
    "history.action_unavailable": "Coming soon",
    "history.delete_confirm_title": "Delete this chat?",
    "history.delete_confirm_desc":
      "This action cannot be undone. The chat and its messages will be permanently removed.",
    "history.delete_confirm_action": "Delete",
    "history.delete_confirm_cancel": "Cancel",

    "history.page_title": "Chat history",
    "history.page_description":
      "All conversations and archived chats in the portal.",
    "history.tab_conversations": "Conversations",
    "history.tab_archived": "Archived",
    "history.empty_conversations": "No conversations yet.",
    "history.end_of_list": "End of history",
    "history.loading_more": "Loading more…",
    "history.sign_in_prompt": "Sign in to view your chat history.",
    "history.previous": "Previous",
    "history.next": "Next",
    "history.page_of": "Page {current} of {total}",

    "data_controls.archived_chats_title": "Archived chats",
    "data_controls.archived_chats_description":
      "View, restore, or permanently delete archived conversations.",
    "data_controls.view_archives": "View archives",
    "data_controls.dialog_archived_title": "Archived Chats",
    "data_controls.dialog_archived_description":
      "Restore chats to move them back to your history, or delete them permanently.",
    "data_controls.restore_chat_hint": "Restore back to history",
    "data_controls.delete_permanent_hint": "Delete permanently",
    "data_controls.toast_all_chats_archived": "All chats archived",
    "data_controls.toast_archiving_all": "Archiving all chats...",
    "data_controls.toast_archive_all_failed": "Failed to archive all chats",
    "data_controls.toast_load_archived_failed": "Failed to load archived chats",
    "data_controls.toast_chat_restored": "Chat restored",
    "data_controls.toast_restore_failed": "Failed to restore chat",
    "data_controls.toast_chat_deleted": "Chat deleted",
    "data_controls.toast_delete_failed": "Failed to delete chat",

    // Login
    "login.log_in": "Log In",
    "login.or": "or",
    "login.ai_center": "AI Center",
    "login.egt_digital": "",
    "login.email_label": "Email",
    "login.password_label": "Password",
    "login.sign_in_with_m365": "Sign in with Microsoft 365",
    "login.signing_in": "Signing in...",
    "login.m365_description":
      "Use your Microsoft 365 account to access the AI Center",
    "login.m365_only":
      "Microsoft 365 authentication is required for full access",

    "error.access_denied_title": "Access Denied",
    "error.access_denied_message":
      "Your account doesn't have permission to access this environment. Contact your administrator if you believe this is an error.",
    "error.configuration_title": "Configuration Error",
    "error.configuration_message":
      "There is a problem with the authentication configuration. Please contact support.",
    "error.auth_title": "Authentication Error",
    "error.auth_message":
      "There was a problem signing you in. Please try again or contact support.",
    "error.back_to_login": "Back to Login",
  },

  bg: {
    // Portal
    "portal.badge": "AI ПОРТАЛ",
    "portal.hero.title1": "Вашият достъп до AI света",
    "portal.hero.title2": "",
    "portal.hero.gateway": "Вашият достъп до",
    "portal.hero.ai_services": "AI Услуги",
    "portal.hero.subtitle":
      "Открийте AI инструменти, свържете се с услуги и нека Destiny оптимизира работата ви.",
    "portal.destiny.description_short": "AI асистент на EGT",
    "portal.services.tools_desc": "Колекция от полезни инструменти",
    "portal.services.request_desc": "За вашия конкретен случай",
    "portal.search.placeholder":
      "Търсете чатове, документи или попитайте Destiny нещо...",
    "portal.destiny.name": "Destiny",
    "portal.destiny.description":
      "Вашият AI асистент — готов да ви помогне да работите по-умно",
    "portal.destiny.cta": "Отвори чатбота",
    "portal.featured": "Препоръчани връзки",
    "portal.featured.getting_started": "Първи стъпки с Destiny",
    "portal.featured.getting_started_desc":
      "Научете как да използвате AI асистента максимално",
    "portal.featured.jira": "Jira табло",
    "portal.featured.jira_desc":
      "Проследявайте задачите и напредъка по проекти",
    "portal.featured.confluence": "Confluence уики",
    "portal.featured.confluence_desc":
      "Достъп до споделени знания и документация",
    "portal.featured.service_desk": "Сервизно бюро",
    "portal.featured.service_desk_desc":
      "Подайте заявки и проследявайте тикети",
    "portal.news": "Новини и актуализации",
    "portal.news.mcp": "Нови MCP интеграции",
    "portal.news.mcp_desc":
      "Достъп до Teams, Outlook, Jira и Confluence директно чрез Destiny.",
    "portal.news.launch": "Стартиране на портала",
    "portal.news.launch_desc":
      "Новият ви AI Center хъб е на живо. Разгледайте инструменти и ресурси на едно място.",
    "portal.teams.title": "Присъединете се в MS Teams",
    "portal.teams.desc": "Свържете се с екипа на AI Center",
    "portal.teams.cta": "Присъедини се",
    "portal.footer.division": "Дирекция \u201EНаучно моделиране\u201C",
    "portal.footer.desc": "EGT вътрешен дивизионен AI портал",
    "portal.footer.version_label": "Версия",
    "portal.footer.button_guides": "Ръководства",
    "portal.footer.button_changelog": "Промени",
    "portal.footer.button_contact": "Контакт",
    "portal.footer.toast_coming_soon": "Връзката предстои скоро.",
    "portal.gateway": "Вашият достъп до AI услугите",
    "portal.sidebar.ai_portal": "AI Portal",
    "portal.sidebar.egt_digital": "EGT Digital",
    "portal.news_ticker":
      "Новини: Запознайте се с MisterY - Вашият нов AI съдружник!",
    "portal.search_placeholder": "Търсене...",
    "sidebar.blog": "Блог",

    // Changelog
    "changelog.title": "Промени",
    "changelog.description":
      "Бъдете в крак с последните подобрения и нови функции в Destiny AI.",
    "changelog.version": "Версия",
    "changelog.release_date": "Пусната на",
    "changelog.features": "Функции",
    "changelog.improvements": "Подобрения",
    "changelog.bug_fixes": "Поправки",
    "changelog.initial_release": "Първоначално пускане",

    // Portal header
    "header.ai_center": "AI Center",
    "header.ai_center_portal": "AI Center Portal",
    "header.destiny_chatbot": "Destiny чатбот",
    "header.open_ai": "Отвори AI асистент",
    "header.new_conversation": "Нов разговор",
    "header.start_fresh": "Започнете нов чат",
    "header.search_chats": "Търсене на чатове",
    "header.find_past": "Намерете минали разговори",
    "header.services": "Услуги",
    "header.request_service": "Заявка за услуга",
    "header.confluence_ticketing": "Confluence тикети",
    "header.resources": "Ресурси",
    "header.guides": "Ръководства и съответствие",
    "header.changelog": "Changelog за Jira",
    "header.feedback": "Обратна връзка",
    "header.contact": "Свържете се с нас",
    "header.settings": "Настройки",
    "header.sign_out": "Изход",
    "header.sign_in": "Вход",
    "header.not_signed_in": "Не сте влезли",
    "header.signed_in": "Влезли сте",
    "header.light_mode": "Светла тема",
    "header.dark_mode": "Тъмна тема",
    "header.account": "Акаунт",
    "header.open_menu": "Отвори менюто",
    "header.close_menu": "Затвори менюто",
    "header.user": "Потребител",

    // Chat
    "chat.new_chat": "Нов чат",
    "chat.greeting":
      "Аз съм Destiny, готова да ви помогна да работите по-умно, по-бързо и по-ефективно.",
    "chat.compliance1":
      "Destiny е много умна, но не е безгрешна – винаги проверявайте важна информация.",
    "chat.compliance2":
      "Въпреки че Destiny знае български, английският е най-добрият език за разговори.",
    "chat.compliance3":
      "Destiny може да търси в интернет и да осъществява достъп до",
    "chat.compliance3_before_last_link": " и ",
    "chat.compliance3_sentence_end": ".",
    "chat.compliance3_link_aria_confluence":
      "Настройки: Confluence в раздел Приложения",
    "chat.compliance3_link_aria_jira": "Настройки: Jira в раздел Приложения",
    "chat.compliance3_link_aria_service_desk":
      "Настройки: Service Desk в раздел Приложения",
    "chat.terms": "Confluence",
    "chat.and": "Jira",
    "chat.privacy": "Service Desk",
    "chat.placeholder": "Вашият достъп до AI света",
    "chat.scenario_busy":
      "Изчакайте текущия отговор, преди да стартирате сценарий.",
    "chat.attach_tools": "Прикачи и инструменти",
    "chat.voice": "Глас към текст",
    "chat.tone": "Тон и стил",
    "chat.personality": "Персона",
    "chat.coming_soon": "Гласовото въвеждане идва скоро!",
    "chat.tool_on": "Вкл.",
    "chat.remove": "Премахни",
    "chat.scenario_clear": "Премахни сценария",
    "chat.upload_files_aria": "Качване на файлове",
    "chat.web_search": "Уеб търсене",
    "chat.web_search_pending": "Подготовка на търсене…",
    "chat.pdf_empty": "Няма съдържание за печат.",
    "chat.print": "Свали като PDF",

    // Tone & style (personality) — must match `Personality` values in lib/personality.ts
    "personality.default.label": "Стандартен",
    "personality.default.description": "Предварителен стил и тон",
    "personality.professional.label": "Професионален",
    "personality.professional.description": "Изчистен и точен",
    "personality.friendly.label": "Приятелски",
    "personality.friendly.description": "Топъл и разговорлив",

    // Plus menu tools
    "tool.upload": "Качване",
    "tool.prompt_enhancer": "Подобрител на промпт",
    "tool.image": "Изображение",
    "tool.deep_search": "Дълбоко търсене",
    "tool.jira": "Jira",
    "tool.confluence": "Confluence",

    // Scenario tabs
    "scenario.write": "Писане",
    "scenario.think": "Мисли",
    "scenario.create": "Създай",
    "scenario.code": "Код",
    "scenario.improve": "Подобри",
    "scenario.plan": "Планиране",

    "scenario.tab_kickoff.write":
      "Помогни ми с писане — Имам нужда от помощ за създаване, редактиране или подобряване на текст. Моля, попитай за целта, аудиторията и тона преди да започнеш.",
    "scenario.tab_kickoff.think":
      "Помогни ми да помисля по тема — Имам нужда от обяснение, анализ или различни перспективи. Моля, попитай за нивото на знания и каква дълбочина ми е нужна.",
    "scenario.tab_kickoff.create":
      "Помогни ми да създам нещо ново — Имам нужда от идеи, творческо съдържание, сценарии или аналогии. Моля, попитай за целите и ограниченията.",
    "scenario.tab_kickoff.code":
      "Помогни ми с код — Имам нужда от обяснение, преглед, генериране или дебъг. Моля, попитай за нивото на опит и с какво работя.",
    "scenario.tab_kickoff.improve":
      "Помогни ми да подобря работата си — Имам нужда от помощ за самооценка, учебен дизайн, обратна връзка или практика. Моля, попитай за конкретната ситуация.",
    "scenario.tab_kickoff.plan":
      "Помогни ми да планирам — Имам нужда от роудмапове, дневни редове, оценка на рискове или критерии за оценка. Моля, попитай за целите, сроковете и заинтересованите страни.",

    "scenario.write.suggestion1": `Преформулирай и редактирай текст (Моля, пренапиши и подобри този текст с професионално качество.
Преди да започнеш, попитай ме:
- Какъв тон искам? (формален, неформален, убедителен, информативен)
- Каква е основната ми цел? (яснота, краткост, въздействие, корекция на граматиката)
- Има ли конкретни секции, върху които да се съсредоточиш или да избегнеш?
След това:
- Пренапиши текста с подобрена яснота, поток и коректност
- Предложи 2-3 алтернативни версии с различни тонове или структури
- Отбележи ключовите промени и обясни защо подобряват текста
- Предложи предложения за допълнително усъвършенстване)`,

    "scenario.write.suggestion2": `Генерирай шаблон за имейл (Моля, създай професионален и ефективен имейл.
Преди да започнеш, попитай ме:
- Кой е получателят? (роля, взаимоотношение, организация)
- Каква е основната цел? (молба, актуализация, оплакване, запитване, последващо действие)
- Какъв тон е подходящ? (формален, приятелски, настоятелен, дипломатичен)
- Кои са 2-3 ключови точки, които трябва да бъдат включени?
- Има ли желано действие за предприемане?
- Няма ли ограничения? (лимит на думи, краен срок, чувствителни теми)
След това:
- Напиши пълен имейл с привлекателна тема, професионално поздравление, ясно съдържание и подходящо заключение
- Включи втора алтернативна версия с различен подход
- Обясни структурните си избори и предостави съвети за последващи действия)`,

    "scenario.write.suggestion3": `Превод (Моля, осигури точен и естествен превод.
Преди да започнеш, попитай ме:
- Какви са изходният и целевият език?
- Преводът трябва ли да бъде буквален (дума по дума) или естествен (идиоматичен)?
- Коя е целевата аудитория? (носители на езика, обучаващи се, конкретна индустрия)
- Има ли конкретни термини или фрази, които трябва да останат непреведени?
След това:
- Предостави пълния превод с внимателно внимание към нюансите, тона и културния контекст
- Предложи алтернативни формулировки за ключови изречения, ако има множества валидни тълкувания
- Отбележи всякакви идиоми, игра на думи или културно-специфични препратки, които изискват специално внимание)`,

    "scenario.write.suggestion4": `Обобщение и доклад (Моля, обобщи сложна информация в ясни резюме.
Преди да започнеш, попитай ме:
- Какво е предназначението? (ръководно брифиране, лично разбиране, презентация)
- Колко подробно трябва да бъде обобщението? (един абзац, една страница, точки)
- Коя е аудиторията? (техническа, нетехническа, ръководители)
- Кои аспекти са най-важни? (констатации, методология, препоръки, рискове)
След това:
- Предостави структурирано обобщение с:
  • TL;DR - едно изречение същност
  • Ключови точки - 3-7 точки с критична информация
  • Подробно обобщение - разширени абзаци, ако се поискат
  • Елементи за действие или препоръки, ако е приложимо
- Използвай ясни заглавия и форматиране
- Запази важните числа, дати и имена точно)`,

    "scenario.think.suggestion1": `Обясни сложни концепции просто (Моля, направи сложните концепции достъпни.
Преди да започнеш, попитай ме:
- Какво е текущото ми ниво на знания? (начинаещ, средно напреднал, напреднал)
- Какъв е предпочитаният ми стил на учене? (стъпка по стъпка, първо голямата картина, аналогии, примери)
- Какъв е контекстът или целта? (учене, работно решение, любопитство, преподаване)
След това:
- Предостави ясно, структурирано обяснение с:
  • Просто определение на прост език
  • Ключови компоненти или принципи, разбити
  • Конкретни примери или аналогии, съобразени с нивото ми
  • Чести погрешни схващания, които да се избегнат
  • По желание: задълбочено навлизане в напреднали аспекти
- Провери за разбиране и предложи да изясниш допълнително)`,

    "scenario.think.suggestion2": `Сравни и противопостави (Моля, осигури обективно, структурирано сравнение.
Преди да започнеш, попитай ме:
- Какво решение се опитвам да взема или на какъв въпрос отговарям?
- Кои критерии са най-важни? (разходи, качество, време, лекота на използване, мащабируемост, риск)
- Кой ще бъде засегнат от това решение?
- Има ли някакви ограничения или забранени неща?
След това:
- Създай структурирано сравнение с:
  • Преглед на всяка опция
  • Анализ страна до страна спрямо посочените критерии
  • Предимства и недостатъци за всяка опция
  • Компромиси и ключови отличителни черти
  • Контекстуална препоръка въз основа на приоритетите
- Представи информацията неутрално и отбележи къде личните ценности трябва да движат избора)`,

    "scenario.think.suggestion3": `Открий логически пропуски (Моля, критично анализирай аргументите.
Преди да започнеш, попитай ме:
- От какъв контекст е това? (дебат, статия, вземане на решения, лично разсъждение)
- Колко дълбок трябва да бъде анализът? (бърза проверка, задълбочен разбор, академично ниво)
- Търся ли само логически грешки или и предложения за засилване на аргумента?
След това:
- Предостави структуриран анализ с:
  • Обобщение на основното твърдение и разсъждение на аргумента
  • Идентифициране на всякакви логически грешки с ясни обяснения защо всяка е проблематична
  • Примери как грешката се проявява в аргумента
  • Предложения за реформулиране на аргумента по-здравословно
  • Бележка какво прави по-силна версия
- Бъди конструктивен, не пренебрежителен - целта е по-добро разсъждение)`,

    "scenario.think.suggestion4": `Представи различни гледни точки (Моля, представи балансирани, нюансирани перспективи.
Преди да започнеш, попитай ме:
- Каква е моята цел? (разбиране, вземане на решения, подготовка за дебат, преподаване)
- Колко дълбоко да навлезем? (повърхностен преглед, умерен анализ, цялостно разглеждане)
- Има ли конкретни групи заинтересовани страни или гледни точки, които искам да бъдат включени?
След това:
- Предостави мулти-перспективен анализ с:
  • Ясно изявление на проблема и защо има множество валидни гледни точки
  • 3-5 различни перспективи с тяхното основно разсъждение и предположения
  • Доказателства или аргументи, които всяка перспектива използва
  • Силни страни и ограничения на всяка гледна точка
  • Области на обща земя или споделени ценности
  • Ключови компромиси или напрежения между перспективите
- Представи всяка гледна точка справедливо и благотворително, дори ако е противоречива)`,

    "scenario.create.suggestion1": `Брейнсторм за решения (Моля, генерирай разнообразни, приложими идеи.
Преди да започнеш, попитай ме:
- Каква е крайната ми цел или желаният резултат?
- Какви ограничения съществуват? (бюджет, време, ресурси, технически, организационни)
- Кой ще бъде засегнат или ще приложи тези решения?
- Опитвал ли съм вече нещо? Какво работи или не?
След това:
- Предостави разнообразен набор от 5-10 идеи, организирани по:
  • Бързи победи - ниски усилия, високо въздействие
  • Стратегически опции - умерени усилия, устойчиви
  • Творчески подходи - неконвенционални или иновативни
  • Хибридни решения - комбинации от множество подходи
- За всяка идея включи: кратко описание, необходими ресурси, потенциално въздействие и ключови рискове
- Помогни ми да видя възможности, за които не съм се сещал)`,

    "scenario.create.suggestion2": `Творческо съдържание (Моля, създай ангажиращо, добре изработено съдържание.
Преди да започнеш, попитай ме:
- Каква е целта или задачата? (забавление, убеждаване, информиране, вдъхновяване, продажба)
- Коя е целевата аудитория? (демография, интереси, ниво на четене)
- Какъв тон или стил искам? (хумористичен, сериозен, вдъхновяващ, неформален, формален)
- Каква дължина или формат ми е нужен? (брой думи, структура, секции)
- Има ли конкретни теми, съобщения или елементи, които трябва да бъдат включени?
След това:
- Създай оригинално съдържание, което:
  • Започва със силен кук или въведение
  • Поддържа последователен тон и глас през цялото време
  • Включва ярки детайли, примери или елементи на разказване
  • Съответства на посочената цел и аудитория
  • Следва поисканата структура и дължина
- Предложи 1-2 алтернативни версии или вариации, ако е приложимо
- Обясни ключовите творчески избори и предложи начини за адаптиране или разширяване)`,

    "scenario.create.suggestion3": `Разработи сценарии (Моля, изгради реалистични, структурирани сценарии.
Преди да започнеш, попитай ме:
- Каква е целта на този сценарий? (тренировъчно упражнение, стратегическо планиране, оценка на риска, ролева игра)
- Кои са ключовите актьори или заинтересовани страни?
- Какво ниво на реализъм ми е нужно? (високо реалистичен, донякъде правдоподобен, хипотетичен)
- Колко подробен трябва да бъде сценарият? (кратък план, подробен разказ, стъпка по стъпка)
След това:
- Изгради изчерпателен сценарий с:
  • Контекст и предистория - поставяне на сцената с релевантни условия
  • Ключови актьори и техните мотивации, цели и ограничения
  • Централната ситуация или предизвикателство, което движи сценария
  • Последователност от събития или точки на вземане на решения
  • Множество възможни резултати или разклонения въз основа на различни избори
  • Последици и уроци за всеки резултат
- Направи сценария ярък и конкретен с конкретни детайли)`,

    "scenario.create.suggestion4": `Генерирай аналогии (Моля, създай ясни, запомнящи се аналогии.
Преди да започнеш, попитай ме:
- Коя е моята аудитория? (техническа, нетехническа, деца, ръководители, широка публика)
- Коя област или контекст би резонирал с тях? (спорт, готвене, пътуване, технологии, природа, ежедневието)
- Каква е целта? (преподаване, убеждаване, изясняване, помощ за паметта)
- Има ли области, които да се избягват? (твърде технически, културно чувствителни, прекалено използвани)
След това:
- Създай 2-3 различни аналогии с:
  • Самата аналогия - ясно, конкретно сравнение
  • Обяснение на съпоставянето - как всеки елемент съответства на действителната концепция
  • Защо работи - какво прави тази аналогия ефективна за разбиране
  • Ограничения - къде аналогията се разпада или не трябва да се бутва твърде далеч
- Избери аналогии, които са познати на аудиторията, ярки и конкретни)`,

    "scenario.code.suggestion1": `Обясни логиката и целта на кода (Моля, направи кода разбираем.
Преди да започнеш, попитай ме:
- Какво е моето ниво на опит? (начинаещ, средно напреднал, напреднал)
- Запознат ли съм с езика за програмиране и ключовите концепции?
- Каква е моята цел? (разбиране за поддръжка, учене на езика, дебъг, подготовка за интервю)
- Кои части са най-объркващи? (архитектура, конкретни функции, алгоритми, синтаксис)
След това:
- Предостави структурирано обяснение с:
  • Цел - какво прави този код и защо съществува
  • Архитектура на високо ниво - основни компоненти и как взаимодействат
  • Стъпка по стъпка разходка - поток на изпълнение през ключови функции
  • Ключови концепции - обяснение на важни модели или функции на езика
  • Разбивка ред по ред, ако се поиска
  • Примери - примерни входове и очаквани изходи
- Използвай ясен, достъпен език, съобразен с нивото ми
- Включи диаграми или визуални описания, ако е приложимо)`,

    "scenario.code.suggestion2": `Предложи подобрения на кода (Моля, прегледай кода за качество и поддръжка.
Преди да започнеш, попитай ме:
- Какви са моите цели? (производителност, четимост, поддръжка, сигурност, мащабируемост)
- Има ли конкретни ограничения? (съвместимост на API, ограничено време за рефакторинг, стандарти за кодиране)
- Какъв е контекстът? (продукционен код, прототип, учебен проект, наследена кодова база)
- Има ли известни проблеми или болезнени точки, които съм забелязал?
След това:
- Предостави изчерпателен преглед на кода с:
  • Обща оценка - силни страни и ключови области за подобрение
  • Конкретни въпроси, организирани по приоритет (критичен, висок, среден, нисък)
  • За всеки въпрос: описание, защо е важно и предложен фикс
  • Рефакторирани примери за код, показващи подобрени версии
  • Най-добри практики и модели, които биха облагодетелствали този код
  • Компромиси - кога да приложиш всяко предложение
- Съсредоточи се върху промени, които осигуряват най-голяма стойност за усилието
- Обясни 'защо' зад всяка препоръка)`,

    "scenario.code.suggestion3": `Генерирай шаблони и документация (Моля, създай производствено готови шаблони за код.
Преди да започнеш, попитай ме:
- Какъв е конкретният случай на използване или проблем за решаване?
- Какъв framework или библиотеки трябва да се използват (или избягват)?
- Какви функции трябва да бъдат включени? (обработка на грешки, логиране, валидиране, тестване, конфигурация)
- Няма ли стандарти или конвенции за кодиране, които да се следват?
- Имам ли нужда от примери как да използвам или разширя шаблона?
След това:
- Предостави пълен, многократно използваем шаблон с:
  • Чист, идиоматичен код, следващ най-добрите практики на езика
  • Ясна структура с логическо разделяне на отговорностите
  • Изчерпателни коментари, обясняващи 'защо', а не само 'какво'
  • Обработка на грешки и управление на ръбни случаи
  • Опции за конфигурация за персонализиране
  • Примери за употреба, показващи често срещани сценарии
  • Бележки как да разширя или модифицирам за различни нужди
  • Препратки към съответна документация
- Направи шаблона готов за копиране и поставяне и производствено качество)`,

    "scenario.code.suggestion4": `Открий потенциални бъгове (Моля, помогни за диагностициране и поправяне на проблеми с кода.
Преди да започнеш, попитай ме:
- Какви съобщения за грешки или симптоми виждам? (копирай точни грешки, ако е възможно)
- Какво е очакваното поведение спрямо действителното поведение?
- Кога започна това? (нов код, скорошни промени, винаги счупен)
- Какво вече опитах да поправя?
- Каква е моята среда за разработка? (версия на езика, framework, OS, зависимости)
След това:
- Предостави систематична поддръжка за дебъг с:
  • Анализ на проблема - обобщение какво изглежда грешно и защо
  • Идентифициране на основната причина - основният проблем, причиняващ симптомите
  • Стъпка по стъпка фикс - конкретни промени, необходими с примери за код
  • Алтернативни решения, ако съществуват множество подходи
  • Съвети за превенция - как да се избегнат подобни проблеми в бъдеще
  • Предложения за тестване - как да се провери дали фиксът работи
- Ако проблемът е неясен, насочи ме чрез диагностични стъпки за събиране на повече информация
- Обясни разсъждението зад диагнозата си, за да се уча на умения за дебъг)`,

    "scenario.improve.suggestion1": `Чернова на самооценка на представянето (Моля, помогни за изготвяне на убедителна, честна самооценка.
Преди да започнеш, попитай ме:
- Каква е моята роля и ниво? (изпълнител, мениджър, старши, младши)
- Какъв период обхваща това? (тримесечие, година, проект)
- Кои са моите 3-5 най-големи постижения?
- Какви предизвикателства или неуспехи срещнах и как се справих с тях?
- Какви умения или способности развих или подобрих?
- Кой ще чете това? (мениджър, HR, колеги, промоционен комитет)
- Какъв тон е подходящ? (скромен но уверен, базиран на данни, разказ)
След това:
- Изготви структурирана самооценка с:
  • Въвеждащо обобщение - кратък преглед на периода и цялостното представяне
  • Ключови постижения - 3-5 основни постижения с конкретно въздействие и метрики
  • Преодолени предизвикателства - трудности, срещнати и как ги адресирах
  • Растеж и развитие - нови умения, научени обратни връзки, области за подобрение
  • Приноси към екипа/организацията - сътрудничество, менторство, споделяне на знания
  • Бъдещи цели - цели за следващия период с кратък план
  • Балансирана самооценка - признаване на области за растеж
- Използвай конкретни примери и количествени резултати
- Поддържай професионален, уверен тон)`,

    "scenario.improve.suggestion2": `Създай учебни резултати (Моля, дефинирай ясни, измерими учебни резултати.
Преди да започнеш, попитай ме:
- Кои са обучаващите се? (ниво на опит, произход, възраст, професия)
- Какъв е учебният контекст? (курс, работилница, самостоятелно учене, onboarding, сертификация)
- Каква е продължителността или обхватът? (единична сесия, много-седмичен курс, продължаваща програма)
- Какво трябва да могат да ПРАВЯТ обучаващите се след това? (конкретни умения, поведения, приложения)
- Как ще бъде оценено или измерено ученето? (тестове, проекти, демонстрации, наблюдения)
След това:
- Създай изчерпателни учебни резултати с:
  • 4-8 специфични, измерими резултати, използващи глаголи за действие (анализирай, създай, оцени, приложи)
  • Всеки резултат структуриран като: 'В края, обучаващите се ще могат да [ДЕЙСТВИЕ] [ОБЕКТ] [УСЛОВИЕ]'
  • Резултати, организирани по когнитивно ниво (знание, разбиране, приложение, анализ, синтез, оценка)
  • Критерии за успех - как да се разпознае кога всеки резултат е постигнат
  • Предложения за оценка - методи за измерване на всеки резултат
  • Бележки за подравняване - как резултатите се свързват с нуждите на обучаващите се
- Използвай глаголи от таксономията на Bloom подходящо
- Избягвай неясни термини като 'разбирам' или 'зная' - фокусирай се върху наблюдаеми способности)`,

    "scenario.improve.suggestion3": `Шаблони за обратна връзка (Моля, предостави структурирани, професионални шаблони за обратна връзка.
Преди да започнеш, попитай ме:
- Какъв тип обратна връзка е това? (положително подсилване, конструктивна критика, корекция на представянето, обратна връзка от колеги)
- Кой дава обратна връзка на кого? (мениджър към подчинен, колега към колега, обратна връзка към ръководство, между екипи)
- Каква е конкретната ситуация или поведение за адресиране?
- Какво е моето взаимоотношение с получателя? (близко, формално, ново, опънато)
- Какъв е желаният резултат? (промяна в поведението, признание, развитие, документиране)
- Какъв тон е подходящ? (подкрепящ, директен, формален, неформален, твърд)
След това:
- Предостави шаблони за обратна връзка и насоки с:
  • Специфичен за ситуацията шаблон - структурирана рамка, съобразена със сценария
  • Начало - как да се постави конструктивен тон и да се посочи целта
  • Конкретни наблюдения - език за описване на поведения фактологично без преценка
  • Изявление за въздействие - как да се артикулира ефектът от поведението
  • Молба или предложение - ясни, приложими следващи стъпки
  • Предложение за подкрепа - как да се изрази готовност за помощ
  • Примерни скриптове - 2-3 вариации, показващи различни формулировки
  • Съвети за предоставяне - timing, обстановка, препоръки за последващи действия
- Използвай рамки като SBI (Situation-Behavior-Impact) или DESC, където е приложимо
- Балансирай честността с емпатия)`,

    "scenario.improve.suggestion4": `Ролеви разговори (Моля, улесни реалистична ролева игра за развитие на умения.
Преди да започнеш, попитай ме:
- Какъв тип разговор искам да упражнявам? (трудна обратна връзка, преговори, продажбена презентация, разрешаване на конфликти, интервю, оценка на представянето)
- Каква роля да играеш? (служител, мениджър, клиент, интервюиращ, колега, заинтересована страна)
- Какъв е контекстът на сценария? (конкретна ситуация, предистория, залози)
- Какво е моето ниво на опит с този тип разговор?
- Кои конкретни умения искам да фокусирам? (активно слушане, утвърдителност, емпатия, убеждаване, де-ескалация)
- Колко предизвикателен да бъдеш? (подкрепящ, неутрален, съпротивляващ се, враждебен)
След това:
- Улесни ролевата игра с:
  • Кратка настройка на сценария - контекст, предистория на героя и всякакви релевантни детайли
  • Реалистични отговори - реагирай автентично като героя, с подходящи емоции и нива на съпротивление
  • Адаптивна трудност - коригирай въз основа на как се справям
  • Пауза и размисъл - предложи да паузирам за обучение, ако изглеждам заседнал
  • След-разговор обсъждане - какво се справи добре, какво може да се подобри, конкретни предложения
  • Алтернативни подходи - покажи как различни тактики биха могли да променят резултата
  • Ключови фрази и техники - езикови модели, които работят добре за този сценарий
- Създай безопасно пространство за упражняване и правене на грешки
- Балансирай реализма с подкрепящост)`,

    "scenario.plan.suggestion1": `Роудмап и структури на проект (Моля, създай практични, приложими роудмапове.
Преди да започнеш, попитай ме:
- Каква е крайната цел или дефиницията за успех?
- Какъв е графикът? (начална дата, крайна дата, ключови етапи или крайни срокове)
- Кои са ключовите заинтересовани страни и членове на екипа?
- Какви ресурси са налични? (бюджет, хора, инструменти, ограничения)
- Кои са основните резултати или очаквани доставки?
- Има ли известни зависимости, рискове или ограничения?
След това:
- Създай изчерпателен роудмап с:
  • Обобщение - кратък преглед на проекта и подхода
  • Фази или етапи - логическо групиране на работа с ясни цели за всяка
  • График с етапи - ключови дати, резултати и точки на вземане на решения
  • Зависимости - какво трябва да се случи преди друга работа да започне
  • Разпределение на ресурсите - кой е отговорен за какво (RACI, ако е приложимо)
  • Рискови съображения - потенциални препятствия и стратегии за смекчаване
  • Метрики за успех - как да се измери напредък и завършване
  • План за комуникация - как заинтересованите страни ще бъдат актуализирани
- Представи роудмапа в ясна, визуално-приятелска структура
- Балансирай детайла с четимост
- Направи го достатъчно приложим за изпълнение, но гъвкав за адаптиране)`,

    "scenario.plan.suggestion2": `Дневен ред на среща (Моля, създай фокусирани, ефективни дневни редове.
Преди да започнеш, попитай ме:
- Кои са участниците и какви са техните роли?
- Колко дълга е срещата? (15 мин, 30 мин, 1 час, по-дълга)
- Кои са 2-4 ключови резултати, които трябва да бъдат постигнати?
- Има ли конкретни теми, които трябва да бъдат покрити?
- Има ли предварителна работа или подготовка, необходима от участниците?
След това:
- Създай детайлен дневен ред с:
  • Заглавка на срещата - заглавие, дата/време, локация/линк, участници, водещ, протоколчик
  • Цел на срещата - едно ясно изречение, посочващо целта
  • Предварителна работа - всяка подготовка, която участниците трябва да направят предварително
  • Точки с време - всяка тема с: цел (информирай/обсъди/реши), разпределение на времето, отговорник/водещ
  • Почивки - за срещи по-дълги от 60 минути
  • Секция за решения - пространство за записване на ключови решения
  • Секция за задачи - пространство за заснемане на следващи стъпки с отговорници и срокове
  • План за последващи действия - как и кога резултатите ще бъдат комуникирани
- Разпредели времето реалистично (включително буфер)
- Сложи високо-приоритетните точки рано
- Посочи желания резултат за всяка точка (не само теми)
- Включи съвети за поддържане на срещата на път и ангажирана)`,

    "scenario.plan.suggestion3": `Идентифицирай рискове и мерки (Моля, идентифицирай, оцени и планирай за потенциални рискове.
Преди да започнеш, попитай ме:
- Какъв е контекстът и обхватът? (график, бюджет, размер на екипа, сложност)
- Какво е нивото на толеранс към риск на моята организация или екип? (избягващ риск, балансиран, толерантен към риск)
- Какви категории рискове трябва да обмислим? (технически, финансови, оперативни, репутационни, съответствие, пазарни, персонал)
- Има ли известни притеснения или 'слони в стаята'?
- Кои са ключовите заинтересовани страни, засегнати от тези рискове?
След това:
- Създай изчерпателна оценка на риска с:
  • Идентифициране на риска - 10-20 потенциални риска в релевантни категории
  • Анализ на риска за всеки: описание, основни причини, предупредителни знаци
  • Оценка на вероятността - рейтинг (ниска/средна/висока или 1-5 скала)
  • Оценка на въздействието - тежест, ако се случи (ниска/средна/висока или 1-5 скала)
  • Оценка на риска - комбинирана вероятност × въздействие за приоритизиране
  • Стратегии за смекчаване за високо-приоритетни рискове: превантивни действия, планове за непредвидени обстоятелства
  • Отговорници за рискове - кой е отговорен за наблюдение и управление на всеки риск
  • Честота на преглед - колко често да се преоценяват рисковете
- Представи рисковете в ясен приоритетен ред
- Фокусирай енергията върху високо-вероятни, високо-въздействащи рискове
- Балансирай реализма с оптимизъм - не създавай парализа
- Включи както заплахи за смекчаване, така и възможности за преследване)`,

    "scenario.plan.suggestion4": `Разработи критерии за оценка (Моля, създай справедливи, обективни системи за оценка.
Преди да започнеш, попитай ме:
- Какъв е контекстът на решението? (избор, класиране, да/не, приоритизиране, оценяване)
- Кой ще използва тези критерии? (един човек, комитет, автоматизирана система)
- Кои фактори са най-важни за това решение? (разходи, качество, съответствие, риск, иновация, скорост)
- Има ли задължителни изисквания или непререкаеми условия?
- Колко формално трябва да бъде това? (неформален списък, оценъчна скала, претеглена матрица)
След това:
- Създай изчерпателна рамка за оценка с:
  • Критерии за оценка - 5-10 ключови фактора, организирани по категория (напр. технически, финансови, съответствие с културата)
  • Дефиниции на критериите - ясно описание какво означава всеки критерий
  • Тегла или приоритети - относителна важност на всеки критерий (проценти или класиране)
  • Оценъчна скала - консистентна система за оценяване (1-5, 1-10, слабо/отлично) с ясни дефиниции за всяко ниво
  • Оценъчна скала - специфични индикатори или доказателства за всяко ниво на оценяване
  • Задължителни изисквания - всякакви pass/fail условия, които трябва да бъдат срещнати първо
  • Шаблон за оценяване - работен лист или матрица за консистентна оценка на всички опции
  • Правила за решение - как да се интерпретират резултатите и да се направи финалното решение
- Увери се, че критериите са: специфични и измерими, релевантни за решението, независими (не се припокриват), и пълни (покриват всички важни фактори)
- Помогни ми да направя обективни, защитими решения с намален bias)`,

    "chat.suggestion.actionable_response":
      "Моля, предостави професионален, структуриран и практичен отговор.",

    // Sidebar
    "sidebar.destiny": "Destiny",
    "sidebar.delete_all": "Изтрий всички чатове",
    "sidebar.navigation": "Навигация",
    "sidebar.changelog": "Промени",
    "sidebar.knowledge": "Знания",
    "sidebar.tools_collection": "Колекция инструменти",
    "sidebar.request_service": "Заявка за услуга",
    "sidebar.api": "API",
    "sidebar.amadeus_whisper": "Amadeus Whisper",
    "sidebar.custom_chatbot": "Персонализиран чатбот",
    "sidebar.guides": "Ръководства / Съответствие",
    "sidebar.back_portal": "Обратно към AI Portal",
    "sidebar.delete_all_title": "Изтриване на всички чатове?",
    "sidebar.delete_all_desc":
      "Това действие не може да бъде отменено. Всички ваши чатове ще бъдат изтрити завинаги и премахнати от нашите сървъри.",
    "sidebar.cancel": "Отказ",
    "sidebar.delete_all_confirm": "Изтрий всички",

    "sidebar.today": "Днес",
    "sidebar.yesterday": "Вчера",
    "sidebar.previous_days": "Предишни дни",
    "sidebar.history": "История",
    "sidebar.full_history": "Пълна история",

    "sidebar.archived_label": "Архивирани",
    "sidebar.archived_loading": "Зареждане на архивирани чатове...",
    "sidebar.archived_empty": "Няма архивирани чатове.",
    "sidebar.restore_action": "Възстанови в историята",
    "sidebar.toast_archiving_chat": "Архивиране на чат...",
    "sidebar.toast_chat_archived": "Чатът е архивиран",
    "sidebar.toast_archive_failed": "Неуспешно архивиране",
    "sidebar.toast_restoring_chat": "Възстановяване на чат...",
    "sidebar.toast_chat_restored": "Чатът е възстановен",
    "sidebar.toast_restore_failed": "Неуспешно възстановяване",
    "history.action_open": "Отвори чат",
    "history.action_rename": "Преименувай",
    "history.action_archive": "Архивирай",
    "history.action_remove": "Премахни",
    "history.rename_placeholder": "Заглавие на чата",
    "history.toast_renaming_chat": "Преименуване на чат...",
    "history.toast_chat_renamed": "Чатът е преименуван",
    "history.toast_rename_failed": "Неуспешно преименуване",
    "history.toast_archiving_chat": "Архивиране на чат...",
    "history.toast_chat_archived": "Чатът е архивиран",
    "history.toast_archive_failed": "Неуспешно архивиране",
    "history.toast_deleting_chat": "Изтриване на чат...",
    "history.toast_chat_deleted": "Чатът е изтрит",
    "history.toast_delete_failed": "Неуспешно изтриване",
    "history.action_unavailable": "Очаквайте скоро",
    "history.delete_confirm_title": "Изтриване на този чат?",
    "history.delete_confirm_desc":
      "Това действие не може да бъде отменено. Чатът и съобщенията в него ще бъдат изтрити окончателно.",
    "history.delete_confirm_action": "Изтрий",
    "history.delete_confirm_cancel": "Отказ",

    "history.page_title": "История на чатовете",
    "history.page_description": "Всички разговори и архив в портала.",
    "history.tab_conversations": "Разговори",
    "history.tab_archived": "Архивирани",
    "history.empty_conversations": "Все още няма разговори.",
    "history.end_of_list": "Край на историята",
    "history.loading_more": "Зареждане на още…",
    "history.sign_in_prompt": "Влезте, за да видите историята на чатовете.",
    "history.previous": "Назад",
    "history.next": "Напред",
    "history.page_of": "Страница {current} от {total}",

    "data_controls.archived_chats_title": "Архивирани чатове",
    "data_controls.archived_chats_description":
      "Преглед, възстановяване или окончателно изтриване на архивирани разговори.",
    "data_controls.view_archives": "Преглед на архива",
    "data_controls.dialog_archived_title": "Архивирани чатове",
    "data_controls.dialog_archived_description":
      "Възстановете чатове, за да се върнат в историята, или ги изтрийте завинаги.",
    "data_controls.restore_chat_hint": "Възстанови в историята",
    "data_controls.delete_permanent_hint": "Изтрий завинаги",
    "data_controls.toast_all_chats_archived": "Всички чатове са архивирани",
    "data_controls.toast_archiving_all": "Архивиране на всички чатове...",
    "data_controls.toast_archive_all_failed":
      "Неуспешно архивиране на всички чатове",
    "data_controls.toast_load_archived_failed":
      "Неуспешно зареждане на архивирани чатове",
    "data_controls.toast_chat_restored": "Чатът е възстановен",
    "data_controls.toast_restore_failed": "Неуспешно възстановяване",
    "data_controls.toast_chat_deleted": "Чатът е изтрит",
    "data_controls.toast_delete_failed": "Неуспешно изтриване на чат",

    // Login
    "login.log_in": "Вход",
    "login.or": "или",
    "login.ai_center": "AI Center",
    "login.egt_digital": "",
    "login.email_label": "Имейл",
    "login.password_label": "Парола",
    "login.sign_in_with_m365": "Вход с Microsoft 365",
    "login.signing_in": "Влизане...",
    "login.m365_description":
      "Използвайте вашия Microsoft 365 акаунт за достъп до AI Center",
    "login.m365_only":
      "Microsoft 365 автентикацията е задължителна за пълен достъп",

    "error.access_denied_title": "Достъпът е отказан",
    "error.access_denied_message":
      "Вашият акаунт няма разрешение за достъп до тази среда. Свържете се с администратора си, ако смятате, че това е грешка.",
    "error.configuration_title": "Грешка в конфигурацията",
    "error.configuration_message":
      "Има проблем с конфигурацията за автентикация. Моля, свържете се с поддръжката.",
    "error.auth_title": "Грешка при автентикация",
    "error.auth_message":
      "Възникна проблем при влизането. Моля, опитайте отново или се свържете с поддръжката.",
    "error.back_to_login": "Назад към влизане",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function t(lang: string, key: TranslationKey): string {
  const locale = lang === "bg" ? "bg" : "en";
  return translations[locale][key] ?? translations.en[key] ?? key;
}

/** Localized personality name or short description for the chat bar / settings. */
export function tPersonality(
  lang: string,
  value: Personality,
  field: "label" | "description"
): string {
  const key = `personality.${value}.${field}` as TranslationKey;
  return t(lang, key);
}
