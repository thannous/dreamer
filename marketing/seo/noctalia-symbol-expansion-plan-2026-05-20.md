# Noctalia Symbol Expansion Plan - 2026-05-20

## Objective

Move the dream-symbol dictionary from the current 150 useful symbols to 300 useful symbols without creating thin SEO pages. Publish in batches of 25-30 symbols, then measure indexation, impressions, CTR, and internal-link performance before each new batch.

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

## Batch 4: Household And Relationship Symbols

89. apartment
90. stairs
91. elevator
92. window
93. roof
94. hallway
95. mirror
96. closet
97. table
98. chair
99. bed
100. key
101. lock
102. phone
103. message
104. money
105. wallet
106. gift
107. wedding
108. divorce
109. kiss
110. argument
111. betrayal
112. reunion
113. child
114. baby
115. family
116. neighbor
117. ex-partner
118. home-invasion

## Batch 5: Body, Health, And Anxiety Symbols

119. blood
120. teeth-breaking
121. losing-hair
122. naked
123. unable-to-run
124. choking
125. vomiting
126. fever
127. medicine
128. ambulance
129. injection
130. scar
131. skin
132. face
133. mouth
134. voice
135. blindness
136. aging
137. public-speaking
138. crowd
139. locked-room
140. dark-room
141. broken-phone
142. being-lost
143. failing-test
144. running-away
145. falling-elevator
146. panic
147. crying
148. silence

## Batch 6: Travel, Work, And Life Transition Symbols

149. train
150. station
151. taxi
152. motorcycle
153. traffic
154. bridge-collapse
155. tunnel
156. map
157. ticket
158. border
159. foreign-country
160. office
161. meeting
162. boss
163. interview
164. promotion
165. being-fired
166. deadline
167. computer
168. school
169. university
170. diploma
171. library
172. stage
173. camera
174. performance
175. competition
176. winning
177. losing
178. new-job

## Batch 7: Nature, Weather, And Animal Symbols

179. ocean
180. beach
181. wave
182. tsunami
183. rain
184. storm
185. fog
186. wind
187. rainbow
188. mud
189. mountain
190. cliff
191. valley
192. tree
193. forest
194. flowers
195. roots
196. harvest
197. snake-bite
198. spider
199. cat
200. horse
201. lion
202. tiger
203. deer
204. fox
205. bat
206. insect-swarm
207. egg
208. nest

## Batch 8: Spiritual, Mystery, And Transformation Symbols

209. angel
210. temple
211. church
212. cemetery
213. grave
214. coffin
215. ancestor
216. spirit
217. ritual
218. candle
219. clock
220. labyrinth
221. maze
222. portal
223. eclipse
224. full-moon
225. sun
226. stars
227. apocalypse
228. explosion
229. war
230. soldier
231. rescue
232. treasure
233. gold
234. crown
235. wings
236. transformation
237. rebirth
238. prophecy

## Batch 9: Final 62 Query-Led Symbols

Reserve the final 62 symbol slots for J+14 and J+30 Search Console exports. Do not fill these from intuition alone. Pull candidates from queries with impressions for `reve de`, `rêver de`, `dream about`, `soñar con`, `Traum von`, and `sognare`, plus symbols already mentioned in blog posts but missing a symbol page.

## Prioritization Inputs

Use the weekly SEO loop before writing each batch:

1. Search Console queries with impressions but low CTR.
2. Ahrefs warnings and keyword opportunities already logged in the repo.
3. Blog topics that already mention a symbol but lack a symbol page.
4. Competitor dictionary coverage from Dream Moods, Dream Bible, Auntyflo, ThePleasantDream, Dreamiary, and Dreamz.
5. App product utility: symbols that improve guided reflection, recurring-symbol tracking, and onboarding.

## Publication Loop

1. Prepare one batch in `data/dream-symbols.json` and extended interpretation data.
2. Run `npm run docs:build`.
3. Run `npm run docs:check`.
4. Sample 10 pages manually for uniqueness, localized slugs, title/meta, canonical, hreflang, and internal links.
5. Publish, submit sitemap, and record baseline Search Console metrics.
6. Wait 7-14 days before deciding whether to publish the next batch.
