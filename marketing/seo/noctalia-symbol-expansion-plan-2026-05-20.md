# Noctalia Symbol Expansion Plan - 2026-05-20

## Objective

Move the dream-symbol dictionary from 62 to 150 useful symbols without creating thin SEO pages. Publish in batches of 25-30 symbols, then measure indexation, impressions, CTR, and internal-link performance before expanding toward 300+ symbols.

## Quality Bar Per Symbol

Each symbol should have:

- Short summary in all five languages.
- Long interpretation in the extended data source.
- Frequent scenarios or variations.
- Reflection questions.
- Category and localized slug.
- Short FAQ if the page template supports it.
- 1-3 internal links to relevant blog posts, guide pages, or adjacent symbols.
- Clear disclaimer framing the page as reflection, not diagnosis or prediction.

## Batch 1: High-Intent Core Symbols

1. mother
2. father
3. sibling
4. partner
5. friend
6. stranger
7. teacher
8. police
9. doctor
10. coworker
11. grandmother
12. birth
13. funeral
14. grandfather
15. classroom
16. bathroom
17. bedroom
18. kitchen
19. workplace
20. road
21. bus
22. bicycle
23. boat
24. airport
25. suitcase
26. passport
27. ring
28. watch
29. book
30. letter

## Batch 2: Recurring Anxiety And Body Symbols

31. hair
32. eyes
33. hands
34. feet
35. heart
36. pregnancy-test
37. illness
38. basement
39. surgery
40. bleeding
41. drowning
42. trapped
43. attic
44. late
45. missing-train
46. unable-to-speak
47. paralysis
48. screaming
49. hiding
50. shadow
51. ghost
52. demon
53. monster
54. zombie
55. prison
56. earthquake
57. tornado
58. hotel
59. lightning
60. snow

## Batch 3: Animals, Nature, And Transformation

61. mall
62. cow
63. rabbit
64. mouse
65. rat
66. bear
67. elephant
68. fish
69. shark
70. whale
71. dolphin
72. frog
73. butterfly
74. bee
75. ant
76. owl
77. eagle
78. crow
79. rose
80. garden
81. desert
82. island
83. cave
84. river
85. lake
86. waterfall
87. volcano
88. mask

## Prioritization Inputs

Use the weekly SEO loop before writing each batch:

1. Search Console queries with impressions but low CTR.
2. Ahrefs warnings and keyword opportunities already logged in the repo.
3. Blog topics that already mention a symbol but lack a symbol page.
4. Competitor dictionary coverage from Dream Moods, Dream Bible, Auntyflo, ThePleasantDream, Dreamiary, and Dreamz.
5. App product utility: symbols that improve Dream Chat, recurring-symbol tracking, and onboarding.

## Publication Loop

1. Prepare one batch in `data/dream-symbols.json` and extended interpretation data.
2. Run `npm run docs:build`.
3. Run `npm run docs:check`.
4. Sample 10 pages manually for uniqueness, localized slugs, title/meta, canonical, hreflang, and internal links.
5. Publish, submit sitemap, and record baseline Search Console metrics.
6. Wait 7-14 days before deciding whether to publish the next batch.
