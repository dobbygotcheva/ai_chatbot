/**
 * EGT Company Knowledge Base
 *
 * This module contains structured information about Euro Games Technology (EGT)
 * derived from the company catalogue. This knowledge is used to enhance the
 * chatbot's system prompt with accurate company information for employee queries.
 *
 * Last updated: January 2026 (based on EGT Web Catalogue 2026)
 */

export const companyKnowledge = {
  overview: `
**About Euro Games Technology (EGT)**

- **Founded:** 2002
- **Headquarters:** Sofia, Bulgaria
- **CEO:** Vladimir Dokov
- **Industry:** Gaming/Casino technology manufacturer
- **Global Reach:** Machines installed in 100+ countries across Europe, Africa, Asia, and Americas (North, Central, South)
- **Facilities:** 12 buildings in Bulgaria totaling ~51,448 square meters (production, R&D, warehouse, administration)
- **Distribution Network:** 28 foreign offices and dealers worldwide
- **Certifications:** 
  - ISO 9001:2015 quality management system (certified by Lloyd's Register Quality Assurance)
  - SAP ERP integrated business management system
  - International certificates from various regulatory agencies and testing laboratories
`,

  businessFocus: `
**Core Business Activities:**

EGT is a full-cycle gaming manufacturer handling:
- Development (R&D)
- Production/Manufacturing
- Sales
- Technical support

The company serves casino operators and players globally with high-standard gaming products.
`,

  productPortfolio: `
**Product Range:**

1. **Slot Machines & Cabinets:**
   - Supreme Cabinets (premium series)
   - General Cabinets (standard series, including General Series with curved displays)
   - Phoenix Cabinets
   - AWP (Amusement with Prize) Cabinets for specific markets

2. **Jackpot Systems:**
   - Multi-level progressive jackpots
   - Examples: Grand Link Gold, Bell Link (Boost), Gods & Kings Link
   - Typically feature 4 levels: GRAND & MAJOR (progressive), MINOR & MINI (fixed)
   - Compatible with SAS 6.03 protocol

3. **Games & Multigames:**
   - Single games with various themes
   - Multigame mixes (Supreme Multigames, General Multigames, Power Multigames, Gold Collection HD)
   - Popular titles: 40 Super Hot, Flaming Hot, Shining Crown, Rise of Ra, Burning Hot, etc.

4. **Systems & Software:**
   - **Spider CMS:** Casino Management System for full control of casino operations
   - **Global Solution VLT System:** Video Lottery Terminal system
   - Server-based gaming systems
   - Casino management systems
   - VLT (Video Lottery Terminal) systems

5. **Electronic Table Games (ETG):**
   - Multiplayer gaming solutions
   - Automated table games

6. **Gaming Equipment Accessories:**
   - Various cabinet accessories and components

7. **Subsidiaries:**
   - **EGT Digital:** Focused on online gaming verticals (sports betting, lottery)
   - **EGT Steel Production:** Manufactures housings for slot cabinets
`,

  marketPresence: `
**Regional Offices & Coverage:**

- **Europe:** Multiple offices across European countries
- **Africa:** Offices in Tanzania, Kenya, Nigeria, Ghana, and other African nations
- **Asia:** Presence across Asian markets
- **North America:** Operations in USA and Mexico
- **Central America & Caribbean:** Panama office serving the region
- **South America:** Offices in Brazil, Argentina, Colombia, Peru, Chile, Uruguay, Paraguay

Key regional directors and sales managers operate from local offices with dedicated email contacts (sales-<region>@egt.com pattern).
`,

  companyValues: `
**Company Philosophy:**

*"The only path to success is to give more to the customers, exceeding their expectations and surpassing other suppliers' product developments."*

- Customer-centric approach
- Focus on quality, design, and technology
- Continuous innovation and R&D investment
- Participation in major international gaming industry exhibitions
- Commitment to operational excellence through SAP and ISO standards
`,

  employeeGuidance: `
**For Employees:**

- **Default Location:** Most users are based in Sofia, Bulgaria
- **Company Email Pattern:** firstname.lastname@egt.com
- **Regional Sales Contacts:** sales-<region>@egt.com
- **Internal Systems:** 
  - SAP ERP for business management
  - Atlassian (Confluence/Jira) for documentation and project tracking
  - Spider CMS for casino management (product knowledge)
`,
} as const;

/**
 * Generates a concise company knowledge summary for the system prompt.
 * This is optimized for token efficiency while retaining key information.
 */
export function getCompanyKnowledgePrompt(): string {
  return `
**About EGT (Euro Games Technology) - Company Knowledge:**

EGT is a leading gaming technology manufacturer founded in 2002, headquartered in Sofia, Bulgaria (CEO: Vladimir Dokov).

**Operations:**
- 12 facilities in Bulgaria (~51,448 m²), 28+ international offices
- Products in 100+ countries (Europe, Africa, Asia, Americas)
- ISO 9001:2015 certified, SAP ERP user

**Product Portfolio:**
1. **Slot Cabinets:** Supreme, General (with curved displays), Phoenix, AWP series
2. **Jackpot Systems:** Multi-level progressives (Grand Link, Bell Link, Gods & Kings)
3. **Games:** 40 Super Hot, Flaming Hot, Shining Crown, Rise of Ra, etc.
4. **Systems:** Spider CMS (casino management), Global Solution VLT
5. **Electronic Table Games:** Multiplayer solutions
6. **Subsidiaries:** EGT Digital (online gaming), EGT Steel Production (cabinet housings)

**Employee Info:**
- Email format: firstname.lastname@egt.com
- Default location: Sofia, Bulgaria
- Use Atlassian (Confluence/Jira) for documentation and tickets
`.trim();
}
