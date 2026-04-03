# ROLL FORMING MEGA KNOWLEDGE (FULL PRODUCTION SYSTEM)

MANDATORY:
This document must be read fully before any design or code.

DO NOT SKIP.
DO NOT SUMMARIZE.
DO NOT GUESS.

---

## SECTION 1: CORE PRINCIPLE

Roll forming is incremental bending.

RULE:
Each station performs partial deformation.

FAIL:
Large deformation in one step causes defects.

---

## SECTION 2: PROCESS OVERVIEW

Flow:
material -> strip -> flower -> stations -> rolls -> simulation -> validation

DO NOT CHANGE ORDER.

---

## SECTION 3: ENGINEERING PHYSICS

Includes:
- elastic deformation
- plastic deformation
- strain accumulation

KEY:
Strain must be controlled.

FAIL:
Uncontrolled strain causes edge wave and twist.

---

## SECTION 4: REQUIRED INPUT DATA

- profile geometry
- thickness
- material grade
- yield strength
- bend radii
- tolerance

NO INPUT = NO ACCURACY.

---

## SECTION 5: STRIP WIDTH CALCULATION

Use bend allowance.

K-factor guidance:
- mild steel: 0.35-0.40
- high strength: 0.40-0.55

Strip width must be validated later.

---

## SECTION 6: FLOWER PATTERN (MOST IMPORTANT)

Flower defines:
- deformation sequence
- bend progression

RULES:
- progressive bending
- no angle jump
- maintain bend access

GOOD:
0 -> 20 -> 45 -> 70 -> 90

BAD:
0 -> 90

---

## SECTION 7: STATION DESIGN

Depends on:
- material
- thickness
- geometry
- asymmetry

More complexity requires more stations.

---

## SECTION 8: MATERIAL BEHAVIOR

Higher strength:
- more springback
- more stations

Thicker material:
- larger radii

---

## SECTION 9: SPRINGBACK

Depends on:
- material
- thickness
- radius

Typical:
- mild steel: 2-3 deg
- high strength: 5-15 deg

NEVER CONSTANT.

---

## SECTION 10: ROLL TOOLING PRINCIPLE

Rolls must be derived from geometry.

NOT ALLOWED:
- circular placeholder rolls

---

## SECTION 11: ROLL DESIGN ELEMENTS

Each roll must include:
- groove shape
- face width
- diameter
- bore

---

## SECTION 12: UPPER/LOWER RELATION

Must:
- match geometry
- maintain thickness gap
- avoid interference

---

## SECTION 13: PASS DESIGN

Each pass:
- reduces strain
- shapes profile
- supports previous geometry

---

## SECTION 14: DEFECT CONTROL

1. edge wave -> strain too high
2. twist -> asymmetry
3. flare -> stress imbalance
4. camber -> uneven forming

---

## SECTION 15: MACHINE LIMITS

Check:
- roll diameter
- shaft size
- spacing
- alignment

---

## SECTION 16: FLOWER -> ROLL DERIVATION

FLOW:
flower -> station -> roll contour

Never reverse.

---

## SECTION 17: SIMULATION TYPES

1. precheck -> approximate
2. FEA -> real physics

RULE:
No solver -> no FEA claim.

---

## SECTION 18: SIMULATION OUTPUT

- strain
- stress
- springback
- deformation

---

## SECTION 19: ADVANCED SIMULATION

Requires:
- mesh
- contact model
- material model

---

## SECTION 20: VALIDATION

Measure:
- angle error
- width error
- height error
- contour mismatch

---

## SECTION 21: ACCURACY RULE

TARGET = 99%

No measurement -> no claim.

---

## SECTION 22: DESIGN FLOW

STEP 1 -> input
STEP 2 -> strip width
STEP 3 -> flower
STEP 4 -> station
STEP 5 -> roll
STEP 6 -> simulation
STEP 7 -> validation

---

## SECTION 23: FAILURE CONDITIONS

FAILED IF:
- round rolls
- no flower
- no dimensions
- no validation
- fake simulation claims

---

## SECTION 24: ENGINEERING LOGIC SUMMARY

- deformation must be gradual
- geometry drives tooling
- material drives behavior
- validation proves accuracy

---

## SECTION 25: FINAL LAW

DO NOT:
- design rolls before flower
- claim accuracy without proof
- skip steps

END OF DOCUMENT

