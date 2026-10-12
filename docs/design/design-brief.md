# Make group football predictions easy, social, and fun

La Goyniela helps groups of football supporters turn individual match predictions into one shared quiniela. The product reduces the friction of reaching an agreement while preserving the social enjoyment of comparing opinions with friends.

## Brief status

**Agreed for product-design planning.** Detailed interaction rules, edge cases, visual direction, and implementation remain intentionally deferred to their corresponding phases.

## Product objective

Provide a simple and entertaining way for a peña to collect its members' predictions and produce a quiniela that represents the group's overall opinion.

## Audience

The primary audience is a group of peñistas who want to participate in a shared football quiniela.

| Role | Responsibility |
| --- | --- |
| Group administrator | Creates the group and initiates each matchday quiniela. |
| Group member | Reviews the matchday, optionally checks submitted peer predictions, and submits an individual prediction. |

## Problem

Group members often prefer different results and struggle to agree on a single quiniela. Coordinating those opinions manually creates unnecessary discussion and makes participation harder than it should be.

## Value proposition

La Goyniela converts individual predictions into a transparent group consensus. It is not merely a digital quiniela form: its core value is helping the group reach a representative result together.

## Primary experience

1. A member opens the dashboard and enters their group.
2. The administrator initiates the matchday quiniela.
3. Members review the matchday and its matches.
4. Members may reveal predictions already submitted by teammates.
5. Each member submits an individual prediction.
6. La Goyniela produces the group's quiniela from the available participation.

## Primary actions

- **Administrator:** initiate the group's matchday quiniela.
- **Member:** submit a prediction for the active matchday.
- **Group:** understand the resulting collective opinion.

## Product constraints

- The experience is mobile-first.
- The product manages predictions and consensus only; it does not manage real-money gambling, balances, payments, or payouts.
- Product language should prefer **prediction** and **vote** over terminology that implies real-money betting.
- Only the group administrator can initiate a matchday quiniela.
- Viewing teammates' submitted predictions is optional rather than forced.
- The experience must remain useful when participation is incomplete.

## Success definition

The design succeeds when group members can quickly understand what requires their attention, submit a prediction without coordination overhead, and recognize how individual votes contribute to the shared quiniela.

## Deferred deliberately

The following decisions belong to later design phases and must not expand this brief:

- Exact deadlines and incomplete-participation behavior.
- Vote aggregation and tie-breaking rules.
- Detailed permissions and exceptional states.
- Navigation structure and page inventory.
- Visual identity, components, motion, and responsive composition.
- API operations and implementation architecture.

## Next phase

Research comparable products, relevant social-prediction patterns, and visual references. The outcome will be a benchmark and moodboard grounded in this brief.
