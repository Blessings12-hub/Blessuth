// Each question is [selfQ, guessQ, options].
// selfQ is asked in Round 1 ("About you") — answer honestly about yourself.
// guessQ is asked in Round 2 ("Guess {partner}") — {partner} is replaced
// with the partner's name at render time. Same options for both, so a
// guess can be scored against the partner's real answer.

const QUIZ_TOPICS = {
  gettingToKnow: {
    title: 'Getting to Know You',
    subtopics: {
      personality: {
        title: 'Personality',
        questions: [
          ["What's your love language?", "What do you think {partner}'s love language is?", ['Words of affirmation', 'Quality time', 'Acts of service', 'Physical touch']],
          ["What's your biggest pet peeve?", "What do you think {partner}'s biggest pet peeve is?", ['Being late', 'Loud chewing', 'Messy spaces', 'Being interrupted']],
          ['How do you recharge after a long day?', 'How do you think {partner} recharges after a long day?', ['Alone time', 'Talking it out', 'Exercise', 'Watching something']],
          ["What's your biggest fear?", "What do you think {partner}'s biggest fear is?", ['Failure', 'Heights', 'Being alone', 'Public speaking']],
          ['How do you show love best?', 'How do you think {partner} shows love best?', ['Gifts', 'Compliments', 'Helping out', 'Hugs & cuddles']],
          ['What stresses you out most?', 'What do you think stresses {partner} out most?', ['Deadlines', 'Conflict', 'Uncertainty', 'Clutter']],
        ],
      },
      dailyHabits: {
        title: 'Daily Habits',
        questions: [
          ["What's your ideal Friday night?", "What do you think {partner}'s ideal Friday night is?", ['Movie night in', 'Out with friends', 'Quiet & early sleep', 'Trying something new']],
          ['Are you a morning person or a night owl?', 'Do you think {partner} is a morning person or a night owl?', ['Morning person', 'Night owl']],
          ['How do you like to start your day?', 'How do you think {partner} likes to start their day?', ['Slow and quiet', 'Straight into it', 'With coffee, no talking', 'Checking my phone first']],
          ['What does your ideal weekend look like?', "What does {partner}'s ideal weekend look like?", ['Doing nothing at all', 'Packed with plans', 'One low-key outing', 'Catching up on chores, then relaxing']],
          ['How organized are you, honestly?', 'How organized do you think {partner} is, honestly?', ['Very — everything has a place', 'Organized where it counts', 'Controlled chaos', "Let's not talk about it"]],
          ['What throws off your whole day?', "What do you think throws off {partner}'s whole day?", ['Running late', 'A bad night of sleep', 'An unexpected change of plans', 'Being hungry']],
        ],
      },
    },
  },

  thisOrThat: {
    title: 'This or That',
    subtopics: {
      lifestyle: {
        title: 'Lifestyle',
        questions: [
          ['Beach or mountains?', 'Would {partner} pick beach or mountains?', ['Beach', 'Mountains']],
          ['Texting or calling?', 'Would {partner} pick texting or calling?', ['Texting', 'Calling']],
          ['Home body or always out?', 'Would {partner} pick home body or always out?', ['Home body', 'Always out']],
          ['Plan ahead or spontaneous?', 'Would {partner} pick plan ahead or spontaneous?', ['Plan ahead', 'Spontaneous']],
          ['Early start or sleep in?', 'Would {partner} pick early start or sleep in?', ['Early start', 'Sleep in']],
          ['Big party or small gathering?', 'Would {partner} pick big party or small gathering?', ['Big party', 'Small gathering']],
        ],
      },
      preferences: {
        title: 'Preferences',
        questions: [
          ['Sweet or savory?', 'Would {partner} pick sweet or savory?', ['Sweet', 'Savory']],
          ['Coffee or tea?', 'Would {partner} pick coffee or tea?', ['Coffee', 'Tea']],
          ['Save or spend?', 'Would {partner} pick save or spend?', ['Save', 'Spend']],
          ['Window or aisle seat?', 'Would {partner} pick window or aisle?', ['Window', 'Aisle']],
          ['Book or movie?', 'Would {partner} pick book or movie?', ['Book', 'Movie']],
          ['Dogs or cats?', 'Would {partner} pick dogs or cats?', ['Dogs', 'Cats']],
        ],
      },
    },
  },

  futureDreams: {
    title: 'Future Dreams',
    subtopics: {
      ourFuture: {
        title: 'Our Future',
        questions: [
          ['Where do you picture us in 5 years?', 'Where do you think {partner} pictures us in 5 years?', ['Same city, different home', 'A new city together', 'Traveling the world', "Not sure yet, and that's ok"]],
          ['How do you picture our wedding, hypothetically?', 'How do you think {partner} pictures our wedding?', ['Small & intimate', 'Big celebration', 'Destination wedding', 'Courthouse & a party']],
          ['How many kids, if any, do you picture?', 'How many kids do you think {partner} pictures?', ['None', 'One', 'Two', 'Three or more']],
          ['What matters most in our future home?', 'What do you think matters most to {partner} in our future home?', ['Location', 'Space & comfort', 'Close to family', 'Budget-friendly']],
          ['What kind of vacations do future us take?', 'What kind of vacations do you think {partner} pictures?', ['Relaxing beach trips', 'Adventure travel', 'City exploring', 'A mix of everything']],
          ['What should we work on most together?', 'What do you think {partner} would say we should work on most?', ['Communication', 'Finances', 'Quality time', 'Long-term planning']],
        ],
      },
      bigGoals: {
        title: 'Big Life Goals',
        questions: [
          ['What goal do you want us to hit together?', 'What goal do you think {partner} wants us to hit together?', ['Buy a home', 'Travel to 5 new countries', 'Start a family', 'Build a business']],
          ["What's a dream you haven't told me about?", "What kind of dream do you think {partner} hasn't told you about?", ['Career change', 'Living abroad', 'Creative project', 'An adventure goal']],
          ['What legacy do you want to leave?', 'What legacy do you think {partner} wants to leave?', ['Something I built', 'People I helped', 'A family I raised', "I haven't thought that far"]],
          ['What would you regret not doing?', 'What do you think {partner} would regret not doing?', ['Not traveling enough', 'Not taking a career risk', 'Not saying how I feel', 'Not slowing down enough']],
          ["What's a milestone you're most looking forward to?", 'What milestone do you think {partner} is most looking forward to?', ['Moving in together', 'Getting married', 'A big trip together', 'Just being in the same city']],
          ["How ambitious are your 10-year plans?", "How ambitious do you think {partner}'s 10-year plans are?", ['Very — big swings only', 'Steady and realistic', 'Flexible, figuring it out', "I don't really plan that far"]],
        ],
      },
    },
  },

  deepTalks: {
    title: 'Deep Talks',
    subtopics: {
      loveAndConnection: {
        title: 'Love & Connection',
        questions: [
          ['What does being loved well look like to you?', 'What do you think being loved well looks like for {partner}?', ['Feeling heard', 'Feeling chosen', 'Feeling supported', 'Feeling safe']],
          ['What do you need most when upset?', 'What do you think {partner} needs most when upset?', ['Space', 'Reassurance', 'A hug', 'To talk it out']],
          ['How do you define a successful relationship?', 'How do you think {partner} would define a successful relationship?', ['Trust', 'Growing together', 'Fun & laughter', 'Deep understanding']],
          ['What helps you feel most secure with a partner?', 'What do you think helps {partner} feel most secure with you?', ['Consistency', 'Affection', 'Honesty', 'Quality time']],
          ['What do you admire most in a partner?', 'What do you think {partner} admires most in you?', ['Kindness', 'Drive', 'Humor', 'Strength']],
          ["What's a small gesture that means the most to you?", 'What small gesture do you think means the most to {partner}?', ['An unprompted text', 'Being remembered in small things', 'Physical affection', 'Someone showing up for me']],
        ],
      },
      fearsAndGrowth: {
        title: 'Fears & Growth',
        questions: [
          ["What's something you're still healing from?", "What do you think {partner} is still healing from?", ['A past relationship', 'Family stuff', 'Self-doubt', 'Old fears']],
          ["What's a value you'll never compromise on?", "What value do you think {partner} would never compromise on?", ['Honesty', 'Loyalty', 'Respect', 'Independence']],
          ["What's your biggest insecurity about a relationship?", "What do you think {partner}'s biggest insecurity about us is?", ['Not being enough', 'Distance apart', 'Miscommunication', 'The future']],
          ['How do you handle conflict?', 'How do you think {partner} handles conflict?', ['I need space first', 'I want to talk it out right away', 'I shut down', 'I try to fix it fast']],
          ['What has this relationship taught you about yourself?', 'What do you think this relationship has taught {partner} about themselves?', ['That I can be vulnerable', 'That I’m more patient than I thought', 'What I actually need', 'How much I can grow']],
          ["What's a fear you've overcome because of this relationship?", 'What fear do you think {partner} has overcome because of this relationship?', ['Fear of being truly known', 'Fear of depending on someone', 'Fear of being left', 'Fear of not being enough']],
        ],
      },
    },
  },

  sillyFun: {
    title: 'Silly & Fun',
    subtopics: {
      randomAndWeird: {
        title: 'Random & Weird',
        questions: [
          ['If you were a superhero, your power would be?', "What power do you think {partner}'s would be?", ['Mind reading', 'Flying', 'Super strength', 'Invisibility']],
          ["What's your most-used emoji?", "What do you think {partner}'s most-used emoji is?", ['Crying laughing', 'A heart', 'Eye-roll', 'Little peeking eyes']],
          ['If you had a spirit animal, it’d be?', "What spirit animal do you think {partner}'s would be?", ['A cat', 'A golden retriever', 'An owl', 'A raccoon']],
          ['What would your villain origin story be?', "What would {partner}'s villain origin story be?", ['Bad wifi', 'Someone cut in line', 'Cold food', 'Being woken up early']],
          ['What conspiracy theory do you secretly enjoy?', 'What conspiracy theory do you think {partner} secretly enjoys?', ['Aliens are real', 'The moon landing debate', 'Ancient civilizations had help', "I don't believe any of them, but they're fun"]],
          ['What weird talent do you have?', "What weird talent do you think {partner} has?", ['A useless impression', 'Random trivia recall', 'Can wiggle my ears/nose', "I genuinely don't have one"]],
        ],
      },
      ifIWere: {
        title: 'If I Were...',
        questions: [
          ["If we were a sitcom duo, we'd be?", 'What kind of sitcom duo do you think {partner} would say we are?', ['The chaotic ones', 'The wholesome ones', 'The bickering-but-cute ones', 'The unexpectedly perfect match']],
          ['My karaoke song would be?', "What do you think {partner}'s karaoke song would be?", ['A power ballad', 'A pop banger', 'An old classic', "I don't do karaoke"]],
          ["What's your go-to dance move?", "What do you think {partner}'s go-to dance move is?", ['The head bob', 'Full-on chaos', 'The two-step', "I don't dance"]],
          ['If you had a theme song, what genre would it be?', "What genre do you think {partner}'s theme song would be?", ['An epic orchestral score', 'An upbeat pop anthem', 'A chill lo-fi track', 'A dramatic power ballad']],
          ['If you won the lottery tomorrow, first move?', "What do you think {partner}'s first move would be?", ['Pay off everything', 'Book a big trip', 'Tell almost no one', 'Buy something ridiculous first']],
          ['What snack do you always steal from your partner?', 'What snack do you think {partner} always steals from you?', ['Fries', 'Popcorn', 'Chocolate', 'Chips']],
        ],
      },
    },
  },

  travel: {
    title: 'Travel & Adventure',
    subtopics: {
      dreamTrips: {
        title: 'Dream Trips',
        questions: [
          ["What's a dream destination you haven't been to?", 'What dream destination do you think {partner} hasn’t been to yet?', ['Japan', 'Italy', 'New Zealand', "Somewhere we haven't picked yet"]],
          ['What makes a trip memorable for you?', 'What do you think makes a trip memorable for {partner}?', ['The food', 'The scenery', 'The people', 'The stories after']],
          ["What's non-negotiable when you travel?", "What's non-negotiable for {partner} when they travel?", ['Good food', 'Comfortable stay', 'Full itinerary', 'Downtime']],
          ['What kind of trip do you never want to take?', 'What kind of trip do you think {partner} never wants to take?', ['A packed group tour', 'Roughing it with no plan', 'A trip with zero downtime', 'Anywhere too cold']],
          ['If money were no object, where would you go first?', 'Where do you think {partner} would go first?', ['Somewhere far and unfamiliar', 'A place I already love, again', 'A whole multi-country trip', 'Somewhere quiet and remote']],
          ['What souvenir do you always end up bringing home?', 'What souvenir do you think {partner} always brings home?', ['A magnet or trinket', 'Local food or snacks', 'A piece of clothing', "I never buy souvenirs"]],
        ],
      },
      travelStyle: {
        title: 'Travel Style',
        questions: [
          ['Is your ideal travel pace packed or slow?', "Is {partner}'s ideal travel pace packed or slow?", ['Packed itinerary', 'Slow & relaxed', 'A mix of both', 'Wherever the day takes us']],
          ['Road trip or flight?', 'Would {partner} pick road trip or flight?', ['Road trip', 'Flight']],
          ['Camping or hotel?', 'Would {partner} pick camping or hotel?', ['Camping', 'Hotel']],
          ['Who do you think should navigate?', 'Who do you think {partner} would say should navigate?', ['Me', 'You', 'We figure it out together', 'Whoever has signal']],
          ['How do you handle travel hiccups, like a delay?', 'How do you think {partner} handles travel hiccups?', ['Stay calm, adapt', 'Get stressed but push through', 'Need a minute to reset', "I plan for buffer so it rarely happens"]],
          ['Do you over-pack or under-pack?', 'Do you think {partner} over-packs or under-packs?', ['Over-pack, always', 'Under-pack, then regret it', 'I pack exactly right', "Depends entirely on the trip"]],
        ],
      },
    },
  },

  ambitions: {
    title: 'Ambitions & Career',
    subtopics: {
      workLife: {
        title: 'Work Life',
        questions: [
          ['What motivates you most at work?', 'What do you think motivates {partner} most at work?', ['Growth', 'Recognition', 'Stability', 'Passion for the work']],
          ['How do you handle work stress?', 'How do you think {partner} handles work stress?', ['Push through it', 'Talk about it', 'Need space to decompress', 'Distract myself']],
          ['How do you like to be supported in your goals?', 'How do you think {partner} likes to be supported in their goals?', ['Cheerleading', 'Practical help', 'Just believing in me', 'Space to figure it out']],
          ["What's a skill you want to learn?", "What skill do you think {partner} wants to learn?", ['A language', 'A creative skill', 'A technical skill', 'Something totally random']],
          ['What does a bad work day look like for you?', 'What do you think a bad work day looks like for {partner}?', ['Nonstop meetings', 'Feeling unappreciated', 'Nothing going as planned', 'Just being exhausted']],
          ['How do you feel about your current job, honestly?', 'How do you think {partner} feels about their current job?', ['I love it', "It's fine, pays the bills", "I'm ready for something new", "It's a means to an end"]],
        ],
      },
      bigPicture: {
        title: 'Big Picture',
        questions: [
          ["What's your dream job, if money didn't matter?", "What do you think {partner}'s dream job would be?", ['Something creative', 'Something hands-on', 'Something that helps people', 'Running my own thing']],
          ['What does success look like to you?', 'What do you think success looks like to {partner}?', ['Financial freedom', 'Meaningful work', 'Work-life balance', 'Recognition in my field']],
          ['What would you do if money were no object?', 'What do you think {partner} would do if money were no object?', ['Travel indefinitely', 'Start something of my own', 'Keep doing what I love, unpaid or not', 'Support people I care about']],
          ["What's your relationship with ambition?", "How would you describe {partner}'s relationship with ambition?", ['Driven and always chasing more', 'Content, but growing steadily', 'Ambitious in specific areas only', 'Still figuring that out']],
          ['How important is career vs. personal life to you?', 'How important do you think career vs. personal life is to {partner}?', ['Career comes first, for now', "They're equally important", 'Personal life comes first', 'It shifts depending on the season of life']],
          ['What would make you walk away from a job?', 'What do you think would make {partner} walk away from a job?', ['Being disrespected', 'No room to grow', 'Bad pay', 'Losing the passion for it']],
        ],
      },
    },
  },

  nostalgia: {
    title: 'Nostalgia',
    subtopics: {
      childhood: {
        title: 'Childhood',
        questions: [
          ['What was your favorite show as a kid?', "What do you think {partner}'s favorite childhood show was?", ['A cartoon', 'A sitcom', "Something I'm embarrassed to admit", "I don't remember"]],
          ['What were you like in school?', 'What do you think {partner} was like in school?', ['The quiet one', 'The class clown', 'The overachiever', 'A bit of everything']],
          ['What childhood dream job did you have?', 'What childhood dream job do you think {partner} had?', ['Astronaut', 'Something creative', 'Something totally different from now', "I don't remember"]],
          ['What toy or game could you never put down as a kid?', 'What toy or game do you think {partner} could never put down?', ['A video game', 'A specific toy', 'Books', 'Sports equipment']],
          ['Were you closer to your mom or your dad growing up?', 'Do you think {partner} was closer to their mom or dad growing up?', ['Mom', 'Dad', 'Equally close to both', "It's complicated"]],
          ['What did you want to be when you grew up, before it changed?', 'What do you think {partner} originally wanted to be?', ['Something wildly different from now', 'Basically what I do now', "I don't think they know either", 'Something I can actually picture']],
        ],
      },
      growingUp: {
        title: 'Growing Up',
        questions: [
          ['What smell brings back a core memory for you?', 'What smell do you think brings back a core memory for {partner}?', ['Home cooking', 'Rain', 'A specific scent', 'A childhood place']],
          ['What song instantly takes you back?', 'What kind of song do you think instantly takes {partner} back?', ['A childhood favorite', 'A high school anthem', 'A road trip song', 'Something embarrassing']],
          ["What's a family tradition that shaped you?", "What family tradition do you think shaped {partner}?", ['A holiday ritual', 'A weekly routine', 'A saying we grew up with', "We didn't really have one"]],
          ["What was your first job?", "What do you think {partner}'s first job was?", ['Retail', 'Food service', 'Something random', 'I still remember it fondly']],
          ["What's a lesson your younger self would be surprised you learned?", "What lesson do you think {partner}'s younger self would be surprised by?", ['How to be patient', 'How to ask for help', 'How to let go of things', 'How to actually rest']],
          ['What decade of your life do you look back on most fondly?', 'What decade of {partner}’s life do you think they look back on most fondly?', ['Childhood', 'Teenage years', 'Early twenties', "Honestly, right now"]],
        ],
      },
    },
  },

  longDistance: {
    title: 'Long Distance Life',
    subtopics: {
      stayingConnected: {
        title: 'Staying Connected',
        questions: [
          ['How do you prefer to stay in touch during the day?', 'How do you think {partner} prefers to stay in touch during the day?', ['Texting throughout', 'A few longer check-ins', 'A call when we can', 'Whatever fits the day']],
          ['What time-difference habit helps you most?', 'What time-difference habit do you think helps {partner} most?', ['A set daily call time', 'Good morning / goodnight messages', 'Flexibility, no fixed schedule', 'Planning around it a day ahead']],
          ['How should we handle a stretch with no visit date set?', 'How do you think {partner} would want to handle a stretch with no visit date set?', ['Set one as soon as possible', 'Focus on now, plan later', 'Keep a rough idea in mind', 'Talk about it openly and often']],
          ["What kind of message means the most when you're apart?", 'What kind of message do you think means the most to {partner}?', ['A random "thinking of you"', 'A long catch-up text', 'A voice note', 'A good morning text, every day']],
          ['How do you feel about scheduled calls vs. spontaneous ones?', 'How do you think {partner} feels about scheduled vs. spontaneous calls?', ['I like a set time, it feels reliable', 'I prefer spontaneous, it feels natural', 'A mix of both works best', "Honestly, either is fine with me"]],
          ['What app or way of talking do you rely on most?', 'What app or way of talking do you think {partner} relies on most?', ['Texting', 'Video calls', 'Voice notes', 'Whatever’s easiest that day']],
        ],
      },
      missingEachOther: {
        title: 'Missing Each Other',
        questions: [
          ['What do you miss most about being together in person?', 'What do you think {partner} misses most about being together in person?', ['Physical touch', 'Doing everyday things side by side', 'Spontaneous moments', 'Just existing in the same room']],
          ['What helps you most on a hard, missing-you day?', 'What do you think helps {partner} most on a hard day?', ['A call', 'A voice note', 'A distraction together, like a show', 'Just knowing you understand']],
          ["What's something about long distance you've grown to appreciate?", "What do you think {partner} has grown to appreciate about long distance?", ['Anticipation of seeing you', 'Better communication skills', 'Independence', 'Valuing our time more']],
          ['What does our next reunion need to include?', 'What do you think {partner} most wants our next reunion to include?', ['Just us, no plans', 'One big thing we both want to do', 'Comfort food and our usual spots', 'Meeting people from each other’s life']],
          ['What worries you most about the distance?', 'What do you think worries {partner} most about the distance?', ['Growing apart', 'Missing big moments', 'Miscommunication', 'Not really worried, honestly']],
          ['What small thing reminds you of your partner during the day?', 'What small thing do you think reminds {partner} of you during the day?', ['A song', 'A smell or place', 'A specific time of day', 'Something totally random']],
        ],
      },
    },
  },

  foodCooking: {
    title: 'Food & Cooking',
    subtopics: {
      tastesAndCravings: {
        title: 'Tastes & Cravings',
        questions: [
          ["What would be your death-row meal?", "What do you think {partner}'s death-row meal would be?", ['Something home-cooked', 'A restaurant favorite', 'Comfort food', 'Dessert, honestly']],
          ["What's a food you dislike that might surprise people?", 'What food do you think {partner} dislikes that might surprise you?', ['A common favorite', 'Something spicy', 'A specific texture', 'They like most things']],
          ['Sweet tooth or savory cravings?', 'Would you say {partner} has a sweet tooth or savory cravings?', ['Sweet tooth', 'Savory cravings', 'Depends on the day', 'Both, always']],
          ['How adventurous are you with new food?', 'How adventurous do you think {partner} is with new food?', ["Very — I'll try anything", 'Pretty open', 'Cautious but willing', 'I stick to what I know']],
          ['What cuisine could you eat every week?', 'What cuisine do you think {partner} could eat every week?', ['Italian', 'Something spicy, like Thai or Indian', 'Comfort food from home', 'Whatever’s closest']],
          ['What food memory means the most to you?', 'What food memory do you think means the most to {partner}?', ['A dish someone made for me', 'A meal from a specific trip', 'A holiday tradition', 'Something from childhood']],
        ],
      },
      inTheKitchen: {
        title: 'In the Kitchen',
        questions: [
          ['What meal do you make best?', 'What meal do you think {partner} makes best?', ['Something simple and reliable', 'Something ambitious', 'Breakfast food', "I haven't tasted their cooking yet"]],
          ['Who do you think would win a cook-off between you two?', 'Who do you think {partner} would say would win a cook-off?', ['Me', 'You', "It'd be close", "We'd make a great team instead"]],
          ["What meal do you want to cook together next time you're in the same kitchen?", 'What meal do you think {partner} wants to cook together next?', ['Something new to both of us', 'A comfort classic', 'Something from their culture', 'Something from mine']],
          ['How do you feel about following a recipe exactly?', 'How do you think {partner} feels about following a recipe exactly?', ['I follow it to the letter', 'I use it as a rough guide', 'I wing it every time', 'I only cook things I already know']],
          ['What kitchen task do you dislike most?', 'What kitchen task do you think {partner} dislikes most?', ['Chopping vegetables', 'Cleaning up after', 'Waiting for things to cook', "I don't mind any of it"]],
          ["What's your go-to order when you don't feel like cooking?", "What do you think {partner}'s go-to takeout order is?", ['Pizza', 'Something spicy', 'A comfort classic', "Whatever's fastest"]],
        ],
      },
    },
  },

  moviesShows: {
    title: 'Movies & Shows',
    subtopics: {
      watchingHabits: {
        title: 'Watching Habits',
        questions: [
          ["Are you a spoiler-avoider or does it not bother you?", "Do you think {partner} avoids spoilers or doesn't mind them?", ['Avoid at all costs', "Doesn't bother me", 'Depends on the show', 'They spoil things for others, guilty']],
          ['Movie theater or watching on the couch?', 'Would {partner} pick movie theater or the couch?', ['Movie theater', 'Couch, always', 'Depends on the movie', 'Either, I just want the company']],
          ['How do you prefer we handle watching a show apart vs together?', 'How do you think {partner} prefers to handle watching a show apart vs together?', ['Always wait for each other', 'Watch apart, discuss after', 'A mix depending on the show', 'Whoever’s ahead just doesn’t spoil it']],
          ['Do you binge a whole season or space it out?', 'Do you think {partner} binges a whole season or spaces it out?', ['Binge it all in one go', 'One or two episodes at a time', 'Depends entirely on the show', 'I forget shows exist for months, then binge']],
          ['What genre do you reach for most?', 'What genre do you think {partner} reaches for most?', ['Comedy', 'Drama', 'Thriller/horror', 'Documentary']],
          ['What would you rewatch endlessly?', 'What do you think {partner} would rewatch endlessly?', ['A comfort sitcom', 'A specific movie', 'A whole franchise', "I don't really rewatch things"]],
        ],
      },
      favorites: {
        title: 'Favorites',
        questions: [
          ["What's your go-to when you want comfort viewing?", "What do you think {partner}'s go-to comfort viewing is?", ["A show I've seen many times", 'Reality TV', 'Something from childhood', "Whatever's trending"]],
          ['What movie do you think is unfairly underrated?', 'What movie do you think {partner} would say is unfairly underrated?', ['Something from childhood', 'A specific one I could name', 'Honestly, I don’t know', 'I don’t really rate movies that way']],
          ['What show should we start together next?', 'What show do you think {partner} wants us to start next?', ['Something neither of us has seen', 'A rewatch of a favorite', "Whatever you're currently into", "Whatever I'm currently into"]],
          ['What kind of movie do you avoid?', 'What kind of movie do you think {partner} avoids?', ['Horror', 'Overly sad dramas', 'Long, slow-paced films', "I'll watch pretty much anything"]],
          ['Who would you want to grab popcorn with more than anyone?', 'Who do you think {partner} would want to grab popcorn with more than anyone?', ['You', 'A specific friend', 'Family', 'I genuinely don’t mind watching alone']],
          ["What's a movie or show you quote often?", 'What movie or show do you think {partner} quotes often?', ['A comedy', 'A childhood favorite', 'Something niche', "I don't really quote things"]],
        ],
      },
    },
  },

  moneyHome: {
    title: 'Money & Home',
    subtopics: {
      moneyMindset: {
        title: 'Money Mindset',
        questions: [
          ['How do you feel about budgeting?', 'How do you think {partner} feels about budgeting?', ['I track everything closely', 'I keep a rough sense of it', 'I wing it', 'I avoid thinking about it']],
          ['What would you splurge on without much guilt?', 'What do you think {partner} would splurge on without much guilt?', ['Travel', 'Food/going out', 'Gadgets or gear', 'Gifts for people I love']],
          ['Are you a saver or spender, by default?', 'Do you think {partner} is a saver or spender by default?', ['Saver', 'Spender', 'Depends on the month', 'Somewhere in between']],
          ['How do you think we should handle shared expenses eventually?', 'How do you think {partner} would want to handle shared expenses?', ['Split everything evenly', 'Split by income', 'One shared pot for everything', 'Whatever feels fair at the time']],
          ["What's a financial goal you want us working toward?", "What financial goal do you think {partner} wants us working toward?", ['An emergency fund', 'Saving for a big trip', 'Saving for a home', 'Being debt-free']],
          ['How do you feel talking about money with a partner?', 'How do you think {partner} feels talking about money with a partner?', ['Totally comfortable', 'A little awkward, but I do it', 'I avoid it if I can', 'It depends on the topic']],
        ],
      },
      homeLife: {
        title: 'Home Life',
        questions: [
          ['What matters more to you in a home: location or space?', 'What matters more to {partner}: location or space?', ['Location', 'Space', 'Coziness/style', 'Price']],
          ['How tidy do you like your living space, honestly?', 'How tidy do you think {partner} likes their living space?', ['Everything in its place, always', 'Tidy-ish, lived-in', 'Organized chaos', "I genuinely don't notice mess"]],
          ['What makes a house feel like home to you?', 'What do you think makes a house feel like home for {partner}?', ['Familiar smells and sounds', 'The people in it', 'Personal touches everywhere', 'Just having my own space']],
          ['Who do you picture handling most of the household chores?', 'Who do you think {partner} pictures handling most of the chores?', ['Splitting evenly, task by task', 'Whoever’s better at what', 'Alternating weeks', 'Hiring help if we can']],
          ['What house rule do you think matters most?', 'What house rule do you think matters most to {partner}?', ['Shoes off inside', 'No phones at the table', 'Clean as you go', "I don't really have strict rules"]],
          ["What's one home comfort you can't live without?", 'What home comfort do you think {partner} can’t live without?', ['A specific blanket or pillow', 'Good lighting', 'A particular smell/candle', 'Silence and quiet']],
        ],
      },
    },
  },

  valuesAndBeliefs: {
    title: 'Values & Beliefs',
    subtopics: {
      whatMatters: {
        title: 'What Matters',
        questions: [
          ['What do you value most in a friendship?', 'What do you think {partner} values most in a friendship?', ['Loyalty', 'Honesty', 'Consistency', 'Fun and laughter']],
          ['What does respect look like to you in practice?', 'What do you think respect looks like to {partner} in practice?', ['Being listened to', 'Having my time valued', 'Being taken seriously', 'Being given space when needed']],
          ['What cause or issue do you feel most strongly about?', 'What cause do you think {partner} feels most strongly about?', ['Something environmental', 'Something about fairness/justice', 'Something about family/community', "It changes depending on what I've seen recently"]],
          ['How important is tradition to you?', 'How important do you think tradition is to {partner}?', ['Very — I want to keep it going', 'Somewhat, I pick and choose', "Not very, I'd rather build my own", "I haven't thought much about it"]],
          ['What quality do you refuse to tolerate in people?', 'What quality do you think {partner} refuses to tolerate in people?', ['Dishonesty', 'Cruelty', 'Arrogance', 'Flakiness']],
          ['What does a life well-lived mean to you?', 'What do you think a life well-lived means to {partner}?', ['Doing what I love', 'The people I loved and who loved me', 'What I built or left behind', 'How present I was for it']],
        ],
      },
      growth: {
        title: 'Growth',
        questions: [
          ["What's something you're actively trying to improve about yourself?", 'What do you think {partner} is actively trying to improve about themselves?', ['Patience', 'Communication', 'Confidence', 'Letting go of control']],
          ["How do you like to be encouraged when you're struggling?", 'How do you think {partner} likes to be encouraged when struggling?', ['Direct, practical advice', 'Just being told I can do it', 'Someone sitting with me in it', 'Being left alone until I ask']],
          ["What's a belief you've changed your mind about?", 'What belief do you think {partner} has changed their mind about?', ['Something about relationships', 'Something about career/success', 'Something about family', "I can't think of one"]],
          ["What do you think is your biggest area for growth right now?", "What do you think is {partner}'s biggest area for growth right now?", ['Patience', 'Trust', 'Communication', 'Self-care']],
          ['How do you handle being wrong?', 'How do you think {partner} handles being wrong?', ['Owns it quickly', 'Needs a minute before admitting it', 'Gets defensive at first', 'Depends entirely on the situation']],
          ['What helps you grow the most: comfort or challenge?', 'What do you think helps {partner} grow the most: comfort or challenge?', ['Comfort and safety first', 'Being pushed a little', 'A mix of both', "Honestly, I'm not sure"]],
        ],
      },
    },
  },

  everydayYou: {
    title: 'Everyday You',
    subtopics: {
      littleHabits: {
        title: 'Little Habits',
        questions: [
          ["What's a small habit you have that you don't even notice anymore?", 'What small habit do you think {partner} has without noticing?', ['A specific phrase I say a lot', 'A little routine before bed', 'Checking my phone constantly', 'Something with my hands, like tapping']],
          ['How do you take your coffee or tea?', 'How do you think {partner} takes their coffee or tea?', ['Black, no sugar', 'Lots of milk/cream', 'Sweet, however it takes', "I don't drink either"]],
          ["What's your bedtime routine like?", "What do you think {partner}'s bedtime routine is like?", ['Straight to sleep, no fuss', 'Scrolling for a bit first', 'Reading or something calming', 'It varies a lot night to night']],
          ["What's something you always double-check before leaving the house?", 'What do you think {partner} always double-checks before leaving?', ['Keys', 'Phone', 'That everything’s locked/off', "Honestly, I forget things a lot"]],
          ['How do you like your personal space organized, day to day?', 'How do you think {partner} likes their personal space organized?', ['Everything has a specific spot', 'Loosely organized', 'Piles that make sense to me', "I don't really think about it"]],
          ["What's a small thing that instantly puts you in a good mood?", 'What small thing do you think instantly puts {partner} in a good mood?', ['Good weather', 'A specific song', 'A message from someone I love', 'Good food']],
        ],
      },
      comfortAndSelfCare: {
        title: 'Comfort & Self-Care',
        questions: [
          ['How do you like to unwind after a hard week?', 'How do you think {partner} likes to unwind after a hard week?', ['Alone time, no plans', 'Time with people I love', 'Physical activity', 'Doing something creative']],
          ["What's your go-to comfort item or ritual?", "What do you think {partner}'s go-to comfort item or ritual is?", ['A specific blanket or hoodie', 'A favorite show or movie', 'A particular snack', 'Music']],
          ["How do you prefer to be checked on when you're not okay?", "How do you think {partner} prefers to be checked on when they're not okay?", ['A simple "you good?"', 'Someone just being present, no questions', "Being asked directly what's wrong", 'Given space until I bring it up']],
          ['What does self-care actually look like for you?', 'What do you think self-care actually looks like for {partner}?', ['Rest and doing nothing', 'Moving my body', 'Time with people who matter', 'Getting things off my to-do list']],
          ["What's the fastest way to cheer you up?", "What's the fastest way to cheer {partner} up, do you think?", ['Make me laugh', 'Bring me food', 'Just listen', 'Distract me with something fun']],
          ['How do you feel about being alone for a whole day?', 'How do you think {partner} feels about being alone for a whole day?', ['I love it, need it regularly', "It's fine occasionally", 'I start to feel a bit lonely', 'I actively avoid it if I can']],
        ],
      },
    },
  },
}

export default QUIZ_TOPICS
