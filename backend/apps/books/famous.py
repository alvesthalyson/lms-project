"""
Curated 'most famous books' per country, in rough order of fame. The command that uses this asks Open Library
for each title and keeps the first five that have a real cover photo, so the list is longer than five on purpose.

(title, author, category slug). Titles are the ones Open Library knows them by (English for translated works,
Portuguese for Brazilian ones). `AUTHOR_COUNTRY` is the nationality saved on the author (it feeds the Home globe).
"""

from __future__ import annotations

FAMOUS: dict[str, list[tuple[str, str, str]]] = {
    "LK": [
        ("The Seven Moons of Maali Almeida", "Shehan Karunatilaka", "ficcao"),
        ("Anil's Ghost", "Michael Ondaatje", "ficcao"),
        ("Running in the Family", "Michael Ondaatje", "biografia"),
        ("Funny Boy", "Shyam Selvadurai", "ficcao"),
        ("Reef", "Romesh Gunesekera", "ficcao"),
        ("Chinaman: The Legend of Pradeep Mathew", "Shehan Karunatilaka", "ficcao"),
        ("Cinnamon Gardens", "Shyam Selvadurai", "ficcao"),
        ("Island of a Thousand Mirrors", "Nayomi Munaweera", "ficcao"),
        ("The English Patient", "Michael Ondaatje", "romance"),
    ],
    "NP": [
        ("Palpasa Cafe", "Narayan Wagle", "ficcao"),
        ("Arresting God in Kathmandu", "Samrat Upadhyay", "ficcao"),
        ("The Guru of Love", "Samrat Upadhyay", "ficcao"),
        ("The Tutor of History", "Manjushree Thapa", "ficcao"),
        ("The Gurkha's Daughter", "Prajwal Parajuly", "ficcao"),
        ("Forget Kathmandu", "Manjushree Thapa", "historia"),
        ("Karnali Blues", "Buddhisagar", "ficcao"),
        ("Muna Madan", "Laxmi Prasad Devkota", "poesia"),
    ],
    "BD": [
        ("Brick Lane", "Monica Ali", "ficcao"),
        ("A Golden Age", "Tahmima Anam", "ficcao"),
        ("Lajja", "Taslima Nasrin", "ficcao"),
        ("In the Light of What We Know", "Zia Haider Rahman", "ficcao"),
        ("The Good Muslim", "Tahmima Anam", "ficcao"),
        ("Sultana's Dream", "Rokeya Sakhawat Hossain", "ficcao"),
        ("Tree Without Roots", "Syed Waliullah", "ficcao"),
        ("Of Blood and Fire", "Jahanara Imam", "historia"),
        ("The Black Coat", "Neamat Imam", "ficcao"),
    ],
    "CN": [
        ("Dream of the Red Chamber", "Cao Xueqin", "ficcao"),
        ("Journey to the West", "Wu Cheng'en", "fantasia"),
        ("Romance of the Three Kingdoms", "Luo Guanzhong", "historia"),
        ("The Art of War", "Sun Tzu", "filosofia"),
        ("The Three-Body Problem", "Liu Cixin", "ciencia"),
        ("To Live", "Yu Hua", "ficcao"),
        ("Red Sorghum", "Mo Yan", "ficcao"),
        ("Water Margin", "Shi Nai'an", "aventura"),
        ("Tao Te Ching", "Laozi", "filosofia"),
        ("The Analects", "Confucius", "filosofia"),
    ],
    "MN": [
        ("The Secret History of the Mongols", "Anonymous", "historia"),
        ("The Blue Sky", "Galsan Tschinag", "ficcao"),
        ("Altan Tobchi", "Lubsang Danzan", "historia"),
        ("Mongolian Folktales", "Hilary Roe Metternich", "ficcao"),  # a collection; the translator is the credited author
        ("The Gray Mare", "Galsan Tschinag", "ficcao"),
        ("Geser", "Anonymous", "fantasia"),
        ("The Epic of Jangar", "Anonymous", "fantasia"),
    ],
    "BR": [
        ("Dom Casmurro", "Machado de Assis", "romance"),
        ("Grande Sertão: Veredas", "João Guimarães Rosa", "ficcao"),
        ("A Hora da Estrela", "Clarice Lispector", "ficcao"),
        ("Capitães da Areia", "Jorge Amado", "aventura"),
        ("Vidas Secas", "Graciliano Ramos", "ficcao"),
        ("O Alquimista", "Paulo Coelho", "aventura"),
        ("Memórias Póstumas de Brás Cubas", "Machado de Assis", "ficcao"),
        ("Gabriela, Cravo e Canela", "Jorge Amado", "romance"),
        ("Macunaíma", "Mário de Andrade", "ficcao"),
    ],
    "JP": [
        ("Kokoro", "Natsume Sōseki", "ficcao"),
        ("Norwegian Wood", "Haruki Murakami", "romance"),
        ("The Tale of Genji", "Murasaki Shikibu", "romance"),
        ("No Longer Human", "Osamu Dazai", "ficcao"),
        ("Snow Country", "Yasunari Kawabata", "ficcao"),
        ("Kafka on the Shore", "Haruki Murakami", "fantasia"),
        ("I Am a Cat", "Natsume Sōseki", "ficcao"),
        ("Rashōmon and Other Stories", "Ryūnosuke Akutagawa", "ficcao"),
        ("Convenience Store Woman", "Sayaka Murata", "ficcao"),
    ],
}

COUNTRY_NAMES = {
    "LK": "Sri Lanka", "NP": "Nepal", "BD": "Bangladesh", "CN": "China", "MN": "Mongolia", "BR": "Brasil", "JP": "Japão",
}
PER_COUNTRY = 5
