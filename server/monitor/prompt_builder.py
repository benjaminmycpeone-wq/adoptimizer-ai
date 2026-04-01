from ..models import MonitorClient as Client, Topic


def build_prompt(topic: Topic, client: Client) -> str:
    keywords_list = [kw.strip() for kw in (client.keywords or "").split(",") if kw.strip()]
    keywords_str = ", ".join(keywords_list[:12]) if keywords_list else "tax planning, accounting best practices, IRS compliance"

    tone_map = {
        "formal": (
            "Write in a formal, authoritative tone suitable for corporate readers, "
            "CFOs, and financial professionals. Use precise language and industry terminology."
        ),
        "conversational": (
            "Write in a friendly, conversational tone that is approachable and easy to understand. "
            "Use plain language, relatable examples, and avoid excessive jargon."
        ),
    }
    tone_instruction = tone_map.get(client.tone, tone_map["conversational"])

    topic_context = f"TOPIC: {topic.title}"
    if topic.summary:
        topic_context += f"\nSOURCE SUMMARY: {topic.summary}"
    if topic.category:
        topic_context += f"\nCATEGORY: {topic.category}"
    if topic.url:
        topic_context += f"\nREFERENCE: {topic.url}"

    return f"""You are an expert CPA content writer creating a blog post for {client.name}.

TARGET AUDIENCE: {client.audience}

TONE: {tone_instruction}

{topic_context}

SEO REQUIREMENTS:
Naturally incorporate these SEO keywords throughout the article: {keywords_str}.
Use primary keywords in headings and the first 100 words where appropriate.
Write a compelling opening sentence that includes the main keyword.

ARTICLE STRUCTURE:
1. An engaging introduction (2-3 paragraphs) that hooks the reader and explains why this topic matters NOW
2. 3-5 main sections with clear H2 headings (use '## ' prefix), each with 2-3 substantive paragraphs
3. Use H3 subheadings (use '### ' prefix) where needed for complex sections
4. Include a practical takeaways section with bullet points (use '- ' prefix)
5. A brief conclusion with a call-to-action encouraging readers to consult their CPA

FORMAT:
- Use ## for H2 headings and ### for H3 headings
- Use - for bullet points
- Use **bold** for emphasis on key terms
- Aim for 1000-1500 words total
- Include specific numbers, dates, thresholds where relevant

IMPORTANT GUIDELINES:
- Include current, accurate information about this tax/accounting topic
- Reference specific IRS rules, code sections, or regulatory changes where applicable
- Add specific examples relevant to the target audience
- Do not include any disclaimers about being an AI
- Write as if written by a knowledgeable CPA professional at {client.name}
- Do not repeat the title as the first line -- jump straight into the introduction
- Ensure the content is original, informative, and provides genuine value
- Include at least one real-world scenario or example

Begin writing the article now:"""


def build_refresh_prompt(topic: Topic, client: Client, existing_body: str) -> str:
    """Prompt to rewrite/improve an existing post."""
    return f"""You are an expert CPA content editor improving a blog post for {client.name}.

TARGET AUDIENCE: {client.audience}
TOPIC: {topic.title}
TONE: {"Formal and authoritative" if client.tone == "formal" else "Conversational and approachable"}

EXISTING DRAFT:
---
{existing_body[:4000]}
---

Please rewrite and improve this article:
- Strengthen the introduction to be more engaging and timely
- Ensure all headings are clear, descriptive, and include relevant keywords
- Add more specific, actionable advice with concrete examples
- Include specific IRS code sections, thresholds, or dates where applicable
- Improve flow and readability
- Keep the same approximate length (1000-1500 words)
- Use ## for H2, ### for H3, - for bullets, **bold** for emphasis

Write the improved version now:"""
