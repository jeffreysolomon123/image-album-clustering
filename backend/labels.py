# labels.py

RAW_LABELS = [
    # people
    "person","man","woman","child","baby","group of people","crowd",

    # animals
    "dog","cat","bird","horse","cow","sheep","elephant","lion","tiger","bear",
    "monkey","fish","insect","pet","wild animal",

    # places
    "beach","mountain","forest","desert","river","lake","waterfall","ocean",
    "city","street","village","park","garden","indoor","room","office","school",
    "restaurant","hotel","airport","station",

    # objects
    "car","truck","bus","bicycle","motorcycle","train","airplane","boat",
    "building","house","bridge","tower","road","phone","laptop","computer",
    "television","camera","book","bag","watch","glasses","chair","table","bed",

    # food
    "food","fruit","vegetables","meal","dessert","drink","coffee","tea","cake",

    # activities
    "sports","running","walking","swimming","dancing","playing","working",
    "driving","shopping","cooking",

    # nature
    "tree","flower","grass","sky","sunset","sunrise","cloud","snow","rain",
    "night","day",

    # events
    "party","wedding","festival","celebration","meeting","performance",

    # misc
    "art","painting","statue","vehicle","object","scene","landscape"
]

# Convert to CLIP prompts
LABELS = [f"{l}" for l in RAW_LABELS]