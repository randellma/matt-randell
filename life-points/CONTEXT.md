# Life Points

A game for recognizing and rewarding the activities that make a Player's life richer and more varied, without punishment for quiet days. Ysabel is its first Player, not a special case in the model.

## Language

**Activity**:
A repeatable, point-valued way of enriching life, such as taking a walk or visiting a new café. A Game Owner may add, edit, or retire Activities.
_Avoid_: Task, habit, chore

**Activity Entry**:
A record that one or more Activities happened on an editable date. It preserves each Activity's name, category, and point value as they were when logged; every applicable Activity may be included under the honor system.
_Avoid_: Transaction, check-in

**Retired Activity**:
An Activity that is no longer offered for new Activity Entries but remains part of existing history. It may be restored.
_Avoid_: Deleted activity, hidden activity

**Category**:
An editable grouping that gives related Activities a shared name and visual identity. Historical Activity Entries preserve the Category as it appeared when logged.
_Avoid_: Pillar, activity type

**Game**:
A Life Points experience with its own Activities, Monthly Quests, Rewards, and point history. Each Account owns exactly one Game, while the product may host many independent Games.
_Avoid_: Account, workspace

**Account**:
A Player's identity for entering Life Points. Each Account belongs to exactly one Game, either as its Game Owner or as a Participant.
_Avoid_: Login, profile

**Player Name**:
The warm, visible name used for a Player inside their Game. It is distinct from the email address used to enter Life Points.
_Avoid_: Username, email

**Player**:
A person participating in a Game. A Player may be a Game Owner or Participant.
_Avoid_: User, member

**Game Owner**:
A Player who controls a Game's Activities, Monthly Quests, and Rewards.
_Avoid_: Admin, administrator

**Participant**:
A Player who can take part in a Game without controlling its personal Activities, Monthly Quests, or Rewards.
_Avoid_: Guest, secondary user

**Life Garden**:
The Player's permanent visual expression of earned points and variety across Categories. It only grows; quiet periods and Reward claims never diminish it.
_Avoid_: Dashboard, progress ring

**Lifetime Points**:
All personal points a Player has earned. Lifetime Points never decrease when a Reward is claimed.
_Avoid_: Score, total points

**Available Points**:
Personal points a Player has earned but not yet used to claim a Reward.
_Avoid_: Balance, spendable score

**Shared Activity**:
A future Activity involving multiple Players that may contribute to both personal and shared points. Shared play is outside the first release.
_Avoid_: Couple task, joint task

**Shared Adventure Bank**:
A future shared pool earned through Shared Activities and saved toward shared Rewards. Shared scoring is outside the first release.
_Avoid_: Shared score, couple points

**Reward**:
A repeatable, customizable treat or experience with a point cost. A Player may claim it whenever they have enough Available Points or keep saving toward a more expensive Reward.
_Avoid_: Prize, purchase

**Next Reward**:
The least expensive Reward that costs more than the Player's current Available Points. Affordable Rewards remain available for repeated claims.
_Avoid_: Reward Goal, target reward

**Reward History**:
The permanent record of Rewards a Player has claimed. Each claim preserves the Reward's name, cost, and appearance as they were at claim time.
_Avoid_: Purchase history, redemptions

**Corrected Claim**:
A mistaken Reward claim that has been undone, restoring exactly the Available Points originally spent.
_Avoid_: Refund, deleted claim

**Monthly Quest**:
A custom, high-value intention chosen for the month and marked complete by the Player. Activity-derived progress is outside the first release.
_Avoid_: Monthly goal, challenge

**Monthly Reflection**:
An optional record of a moment the Player loved, something they are proud of, and something they want more of after a month ends.
_Avoid_: Review, retrospective

**Monthly Story**:
A private, visual recap of a month's Life Garden, points, variety, completed Monthly Quests, claimed Rewards, and Monthly Reflection.
_Avoid_: Report, share card

**Starter Pack**:
The curated initial set of Categories, Activities, Rewards, and empty Monthly Quest slots given to every new Game. A Game Owner may customize it after entering the Game.
_Avoid_: Defaults, template

**Life Garden**:
A growing visual expression of a Player's activity variety and points. Category plant families show the shape of a life without judging one mixture as better than another.
_Avoid_: Progress chart, score graphic

**Monthly Story**:
A private, screenshot-friendly record of a month's Life Garden, points, variety, completed Monthly Quests, claimed Rewards, and Monthly Reflection.
_Avoid_: Report, share card

## Rules

- Points are earned and never penalized; a day with no Activity Entries is entirely valid.
- An Activity Entry may include every Activity that the Player judges applicable.
- The same Activity may appear in multiple Activity Entries on the same day.
- Claiming a Reward reduces Available Points but never Lifetime Points.
- Claiming a Reward does not retire it; the same Reward may be claimed repeatedly.
- Completing a Monthly Quest awards its configured points when the Player marks it complete.
- Correcting or deleting a mistaken Activity Entry adjusts derived point totals; this is a correction, not a penalty.
- A Monthly Quest awards its points at most once, even if its completion is corrected and restored.
- A month may have zero to three Monthly Quests; three is an invitation, not a quota.
- Editing an Activity affects future Activity Entries only.
- A week runs Monday through Sunday; quiet days never break a streak because Life Points has no streaks.
- Progress never frames lower activity as decline, failure, or falling behind.
- An unfinished Monthly Quest remains in its original month; bringing it forward creates a new Monthly Quest.
- Activity Entries and claimed Rewards may each hold an optional note and photo.
- Affordable Rewards may be claimed; the Next Reward is the cheapest unaffordable Reward.
- When every Reward is affordable, there is no Next Reward.
- Each Account belongs to exactly one Game. A new Account creates a new Game unless it joins an existing Game as a Participant.
- A new Game is created only after its Game Owner's email address is verified.
- Life Points requires a connection for data access and writes; offline logging is outside the first release.
- The Life Garden never shrinks or wilts because of inactivity or Reward claims.
- A correction may redraw the Life Garden so that it agrees with corrected point history.
- Correcting earned points never creates point debt; Available Points stop at zero.
- Each month's Life Garden freezes into its Monthly Story; the Lifetime Garden connects those monthly scenes.
- A Monthly Story is regenerated from corrected history when viewed; its Monthly Reflection remains as written.
- Each Category has a selectable plant family and color accent; points affect abundance and variety affects the mixture.
- Life Points has no third-party analytics or public sharing in the first release.
- Photos are optional, metadata-free memories rather than required evidence of an Activity.
- Point values and Reward costs are positive whole numbers from 1 through 10,000.
- The first release creates every new Game from the Starter Pack; starting from scratch is outside onboarding.
