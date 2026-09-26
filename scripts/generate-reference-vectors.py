"""
Generate cross-check vectors for the test suite from py-enigma
(https://pypi.org/project/py-enigma/), an independent Python implementation.

    python3 -m venv .venv && .venv/bin/pip install py-enigma
    .venv/bin/python scripts/generate-reference-vectors.py > src/enigma/fixtures/reference-vectors.json

The historical vectors in machine.test.ts come from published sources instead
and do not depend on this script.
"""
import json
from importlib.metadata import version
from enigma.machine import EnigmaMachine


def machine(c):
    m = EnigmaMachine.from_key_sheet(
        rotors=" ".join(c["rotors"]),
        reflector=c["reflector"],
        ring_settings=" ".join(str(r) for r in c["rings"]),
        plugboard_settings=c["plugboard"],
    )
    m.set_display(c["start"])
    return m


def lcg_letters(seed, n):
    out, x = [], seed
    for _ in range(n):
        x = (1103515245 * x + 12345) % (2 ** 31)
        out.append(chr(65 + (x >> 16) % 26))
    return "".join(out)


CIPHER_CASES = [
    dict(name="UKW C, IV I V, mixed rings, 6 cables", reflector="C", rotors=["IV", "I", "V"],
         rings=[7, 11, 26], plugboard="AZ BY CX DW EV FU", start="QEV",
         plaintext="THEQUICKBROWNFOXJUMPSOVERTHELAZYDOGWHILETHEROTORSTURNANDTHELAMPSGLOW"),
    dict(name="UKW B, V III II, rings at extremes, no cables", reflector="B", rotors=["V", "III", "II"],
         rings=[26, 1, 13], plugboard="", start="ZZZ",
         plaintext="A" * 60),
    dict(name="UKW C, III II I, 10 cables", reflector="C", rotors=["III", "II", "I"],
         rings=[1, 1, 1], plugboard="AN BO CP DQ ER FS GT HU IV JW", start="XYZ",
         plaintext="ENIGMAMACHINESWEREUSEDBYTHEGERMANARMEDFORCES"),
    dict(name="UKW B, II V IV, 10 cables, 1000 letters", reflector="B", rotors=["II", "V", "IV"],
         rings=[3, 17, 22], plugboard="AG BK CZ DP EW FR HO IX JT LN", start="MEJ",
         plaintext=lcg_letters(1941, 1000)),
    dict(name="UKW C, I II III, 1 cable, 700 letters", reflector="C", rotors=["I", "II", "III"],
         rings=[2, 5, 9], plugboard="QM", start="PDU",
         plaintext=lcg_letters(1938, 700)),
]

STEP_CASES = [
    dict(name="III right, II middle: double step E->F", rotors=["I", "II", "III"], rings=[1, 1, 1], start="ADT", presses=5),
    dict(name="I middle notch Q, rings shifted", rotors=["V", "I", "II"], rings=[13, 20, 4], start="ZPD", presses=6),
    dict(name="IV middle notch J, V right notch Z", rotors=["III", "IV", "V"], rings=[1, 26, 12], start="AIY", presses=6),
    dict(name="V middle notch Z wraps to A", rotors=["II", "V", "I"], rings=[5, 5, 5], start="KYP", presses=30),
    dict(name="III middle notch V, IV right notch J", rotors=["I", "III", "IV"], rings=[1, 1, 1], start="QUI", presses=30),
    dict(name="Left rotor at its own notch does not move by itself", rotors=["I", "II", "III"], rings=[1, 1, 1], start="QAA", presses=3),
]

out = {"generator": f"py-enigma {version('py-enigma')}", "cipher": [], "stepping": []}
for c in CIPHER_CASES:
    out["cipher"].append({**c, "ciphertext": machine(c).process_text(c["plaintext"])})
for s in STEP_CASES:
    m = machine({**s, "reflector": "B", "plugboard": ""})
    windows = [m.get_display()]
    for _ in range(s["presses"]):
        m.key_press("A")
        windows.append(m.get_display())
    out["stepping"].append({**s, "windows": windows})

print(json.dumps(out, indent=2))
