import { Language, Recipe } from '../types';

/**
 * Featured recipes shown on the home dashboard. Localized per language so a
 * Japanese or Korean user doesn't see English placeholder content.
 *
 * IDs are stable across languages so saved-state and dedup logic still work
 * when the user switches locales mid-session.
 */
const FEATURED_RECIPES_BY_LANGUAGE: Record<Language, Recipe[]> = {
  en: [
    {
      id: 'featured-1',
      title: 'Spring Pea & Mint Risotto',
      description:
        'A vibrant, creamy risotto celebrating the best of spring with fresh peas, mint, and a touch of lemon zest.',
      ingredients: [
        { name: 'Arborio Rice', amount: '1.5 cups' },
        { name: 'Fresh Peas', amount: '1 cup' },
        { name: 'Vegetable Broth', amount: '4 cups' },
        { name: 'Fresh Mint', amount: '1/4 cup' },
        { name: 'Lemon', amount: '1' },
        { name: 'Parmesan', amount: '1/2 cup' },
      ],
      instructions: [
        'Heat broth in a saucepan and keep warm.',
        'Sauté onions in butter until translucent.',
        'Add rice and toast for 2 minutes.',
        'Add broth one ladle at a time, stirring constantly.',
        'When rice is al dente, stir in peas, mint, lemon zest, and parmesan.',
        'Serve immediately with a garnish of fresh mint.',
      ],
      preparationTime: '35 mins',
      difficulty: 'Medium',
      calories: 420,
      dietaryTags: ['Vegetarian', 'Seasonal'],
      imagePrompt:
        'Creamy green risotto with peas and mint leaves on a white plate, professional food photography',
      rating: 4.9,
      servings: 4,
    },
    {
      id: 'featured-2',
      title: 'Honey Garlic Glazed Salmon',
      description:
        'Perfectly seared salmon fillets coated in a sticky, sweet, and savory honey garlic sauce.',
      ingredients: [
        { name: 'Salmon Fillets', amount: '2' },
        { name: 'Honey', amount: '3 tbsp' },
        { name: 'Soy Sauce', amount: '1 tbsp' },
        { name: 'Garlic', amount: '3 cloves' },
        { name: 'Lemon Juice', amount: '1 tbsp' },
      ],
      instructions: [
        'Season salmon with salt and pepper.',
        'Whisk honey, soy sauce, lemon juice, and garlic in a small bowl.',
        'Sear salmon in a hot pan for 3-4 minutes per side.',
        'Pour in the sauce and let it bubble and thicken.',
        'Spoon sauce over salmon and serve with steamed broccoli.',
      ],
      preparationTime: '15 mins',
      difficulty: 'Easy',
      calories: 380,
      dietaryTags: ['High Protein', 'Healthy'],
      imagePrompt:
        'Glazed salmon fillet with honey garlic sauce and lemon slices, macro food photography',
      rating: 4.8,
      servings: 2,
    },
    {
      id: 'featured-3',
      title: 'Roasted Mediterranean Veggies',
      description:
        'A colorful medley of seasonal vegetables roasted with olive oil, garlic, and fresh herbs.',
      ingredients: [
        { name: 'Bell Peppers', amount: '2' },
        { name: 'Zucchini', amount: '1' },
        { name: 'Red Onion', amount: '1' },
        { name: 'Cherry Tomatoes', amount: '1 cup' },
        { name: 'Olive Oil', amount: '2 tbsp' },
        { name: 'Dried Oregano', amount: '1 tsp' },
      ],
      instructions: [
        'Preheat oven to 400°F (200°C).',
        'Chop all vegetables into bite-sized pieces.',
        'Toss with olive oil, oregano, salt, and pepper.',
        'Spread on a baking sheet in a single layer.',
        'Roast for 20-25 minutes until tender and slightly charred.',
      ],
      preparationTime: '30 mins',
      difficulty: 'Easy',
      calories: 180,
      dietaryTags: ['Vegan', 'Gluten Free', 'Seasonal'],
      imagePrompt: 'Colorful roasted vegetables on a baking sheet, vibrant Mediterranean style',
      rating: 4.7,
      servings: 4,
    },
  ],
  ja: [
    {
      id: 'featured-1',
      title: '春の豆とミントのリゾット',
      description: '春の訪れを感じる、グリンピースとミント、レモンの香りが爽やかなクリーミーリゾット。',
      ingredients: [
        { name: 'リゾット用米', amount: '300g' },
        { name: 'グリンピース', amount: '150g' },
        { name: '野菜スープ', amount: '1L' },
        { name: 'ミント', amount: 'ひとつかみ' },
        { name: 'レモン', amount: '1個' },
        { name: 'パルメザンチーズ', amount: '50g' },
      ],
      instructions: [
        'スープを鍋で温めておきます。',
        '玉ねぎをバターで炒め、透き通るまで火を通します。',
        '米を加え、2分ほど炒めます。',
        'スープを少しずつ加え、混ぜながら煮ていきます。',
        '米がアルデンテになったら、グリンピース、ミント、レモンの皮、チーズを加えます。',
        'すぐに器に盛り、ミントを添えて完成です。',
      ],
      preparationTime: '35分',
      difficulty: 'Medium',
      calories: 420,
      dietaryTags: ['ベジタリアン', '春'],
      imagePrompt:
        'Creamy green risotto with peas and mint leaves on a white plate, professional food photography',
      rating: 4.9,
      servings: 4,
    },
    {
      id: 'featured-2',
      title: '鮭のはちみつ醤油焼き',
      description: '香ばしく焼いた鮭に、甘辛いはちみつ醤油ダレを絡めた家庭の定番おかず。',
      ingredients: [
        { name: '鮭', amount: '2切れ' },
        { name: 'はちみつ', amount: '大さじ3' },
        { name: '醤油', amount: '大さじ1' },
        { name: 'にんにく', amount: '3片' },
        { name: 'レモン汁', amount: '大さじ1' },
      ],
      instructions: [
        '鮭に塩こしょうをします。',
        'はちみつ、醤油、レモン汁、にんにくを合わせます。',
        '熱したフライパンで両面を3〜4分ずつ焼きます。',
        'タレを加えて煮詰めます。',
        '鮭にタレをかけ、蒸したブロッコリーを添えていただきます。',
      ],
      preparationTime: '15分',
      difficulty: 'Easy',
      calories: 380,
      dietaryTags: ['高タンパク', 'ヘルシー'],
      imagePrompt:
        'Glazed salmon fillet with honey garlic sauce and lemon slices, macro food photography',
      rating: 4.8,
      servings: 2,
    },
    {
      id: 'featured-3',
      title: '彩り野菜のオーブン焼き',
      description: '旬の野菜をオリーブオイルとハーブで焼き上げる、シンプルで色鮮やかな一皿。',
      ingredients: [
        { name: 'パプリカ', amount: '2個' },
        { name: 'ズッキーニ', amount: '1本' },
        { name: '紫玉ねぎ', amount: '1個' },
        { name: 'ミニトマト', amount: '150g' },
        { name: 'オリーブオイル', amount: '大さじ2' },
        { name: 'オレガノ', amount: '小さじ1' },
      ],
      instructions: [
        'オーブンを200℃に予熱します。',
        '野菜を一口大に切ります。',
        'オリーブオイル、オレガノ、塩こしょうで和えます。',
        '天板に並べます。',
        '20〜25分、軽く焦げ目がつくまで焼きます。',
      ],
      preparationTime: '30分',
      difficulty: 'Easy',
      calories: 180,
      dietaryTags: ['ヴィーガン', 'グルテンフリー', '旬'],
      imagePrompt: 'Colorful roasted vegetables on a baking sheet, vibrant Mediterranean style',
      rating: 4.7,
      servings: 4,
    },
  ],
  ko: [
    {
      id: 'featured-1',
      title: '완두콩 민트 리조또',
      description: '봄의 풍미를 가득 담은 부드럽고 크리미한 리조또. 완두콩과 민트, 레몬 향이 어우러집니다.',
      ingredients: [
        { name: '아르보리오 쌀', amount: '300g' },
        { name: '완두콩', amount: '150g' },
        { name: '채소 육수', amount: '1L' },
        { name: '민트', amount: '한 줌' },
        { name: '레몬', amount: '1개' },
        { name: '파마산 치즈', amount: '50g' },
      ],
      instructions: [
        '냄비에 육수를 따뜻하게 데워 둡니다.',
        '버터에 양파를 투명해질 때까지 볶습니다.',
        '쌀을 넣고 2분간 볶습니다.',
        '국자로 한 국자씩 육수를 부어가며 저어 줍니다.',
        '쌀이 알덴테가 되면 완두콩, 민트, 레몬 제스트, 치즈를 넣습니다.',
        '바로 그릇에 담고 민트로 장식합니다.',
      ],
      preparationTime: '35분',
      difficulty: 'Medium',
      calories: 420,
      dietaryTags: ['채식', '제철'],
      imagePrompt:
        'Creamy green risotto with peas and mint leaves on a white plate, professional food photography',
      rating: 4.9,
      servings: 4,
    },
    {
      id: 'featured-2',
      title: '꿀마늘 연어 구이',
      description: '겉은 바삭하게 구운 연어에 달콤짭짤한 꿀마늘 소스를 곁들인 한 끼.',
      ingredients: [
        { name: '연어 필레', amount: '2조각' },
        { name: '꿀', amount: '3큰술' },
        { name: '간장', amount: '1큰술' },
        { name: '마늘', amount: '3쪽' },
        { name: '레몬즙', amount: '1큰술' },
      ],
      instructions: [
        '연어에 소금과 후추로 간을 합니다.',
        '꿀, 간장, 레몬즙, 마늘을 섞어 둡니다.',
        '달군 팬에 연어를 양면 3-4분씩 굽습니다.',
        '소스를 부어 농도가 진해질 때까지 졸입니다.',
        '소스를 끼얹고 데친 브로콜리와 함께 냅니다.',
      ],
      preparationTime: '15분',
      difficulty: 'Easy',
      calories: 380,
      dietaryTags: ['고단백', '건강식'],
      imagePrompt:
        'Glazed salmon fillet with honey garlic sauce and lemon slices, macro food photography',
      rating: 4.8,
      servings: 2,
    },
    {
      id: 'featured-3',
      title: '구운 지중해식 채소',
      description: '제철 채소를 올리브유와 허브에 구운 색감 좋은 구이 요리.',
      ingredients: [
        { name: '파프리카', amount: '2개' },
        { name: '애호박', amount: '1개' },
        { name: '적양파', amount: '1개' },
        { name: '방울토마토', amount: '150g' },
        { name: '올리브유', amount: '2큰술' },
        { name: '오레가노', amount: '1작은술' },
      ],
      instructions: [
        '오븐을 200℃로 예열합니다.',
        '채소를 한입 크기로 썹니다.',
        '올리브유, 오레가노, 소금, 후추로 버무립니다.',
        '베이킹 시트에 한 겹으로 펼칩니다.',
        '20-25분, 살짝 그을릴 때까지 굽습니다.',
      ],
      preparationTime: '30분',
      difficulty: 'Easy',
      calories: 180,
      dietaryTags: ['비건', '글루텐 프리', '제철'],
      imagePrompt: 'Colorful roasted vegetables on a baking sheet, vibrant Mediterranean style',
      rating: 4.7,
      servings: 4,
    },
  ],
};

export function getFeaturedRecipes(language: Language): Recipe[] {
  const base = FEATURED_RECIPES_BY_LANGUAGE[language] || FEATURED_RECIPES_BY_LANGUAGE.en;
  // Tag with the locale we're serving so RecipeCard can decide whether to show
  // a mismatch hint (e.g. user switched to JA but the cached card is in EN).
  return base.map(r => ({ ...r, language }));
}
