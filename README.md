# ABISMO DOS QUATRO — Survivors Multiplayer

Jogo top-down estilo Vampire Survivors com multiplayer real via WebSockets.
4 jogadores, cada um em sua própria aba do navegador, sincronizados em tempo real.

---

## COMO RODAR

### Requisitos
- Node.js 18+ instalado (https://nodejs.org)

### Passostestes

```bash
# 1. Instale as dependêntestescias (só na primeira vez)
npm install

# 2. Inicie o servidor
npm run dev

# 3. Abra no navegador
http://localhost:3000
```

### Para jogar com 4 pessoas
1. Rode `npm run dev` em um computador
2. Todos na mesma rede acessam: `http://IP-DO-COMPUTADOR:3000`
3. Todos digitam o **mesmo código de sala** (ex: `ABISMO`)
4. Cada um escolhe seu nome e classe
5. O **host** (primeiro a entrar) escolhe o mapa e clica **Iniciar Partida**

---

## CONTROLES

| Tecla         | Ação                              |
|---------------|-----------------------------------|
| WASD / Setas  | Mover                             |
| SHIFT         | Dash (3 cargas, recarrega rápido) |
| Q             | Habilidade 1                      |
| E             | Habilidade 2                      |
| R             | Habilidade 3 (ultimate)           |
| B             | Abrir / Fechar Loja               |

---

## ARQUITETURA (conforme GDD)

- **Servidor**: Node.js customizado que roda Next.js + Socket.io na porta 3000
- **Estado da partida**: 100% em memória no servidor (`lib/gameLogic.js`)  
  ⚠️ Se o servidor reiniciar, o progresso e a partida inteira são perdidos (per GDD)
- **Comunicação**: Socket.io em tempo real (20 ticks/segundo)
- **Front-end**: Canvas 2D puro com React para UI

## CLASSES

| Classe     | HP  | MP  | ATQ | DEF | SPD | Estilo         |
|------------|-----|-----|-----|-----|-----|----------------|
| Guerreiro  | 160 | 55  | 12  | 9   | 3.1 | Tanque melee   |
| Mago       | 75  | 160 | 17  | 2   | 3.3 | Dano em área   |
| Clérigo    | 115 | 115 | 7   | 7   | 3.0 | Suporte/cura   |
| Necromante | 90  | 130 | 13  | 3   | 3.2 | Invocações     |
| Arqueiro   | 95  | 85  | 14  | 3   | 4.0 | Distância/spd  |
| Paladino   | 140 | 95  | 10  | 12  | 2.8 | Tanque sagrado |

## MAPAS

| Mapa              | Dificuldade  | Efeito especial         |
|-------------------|--------------|-------------------------|
| Floresta Sombria  | Iniciante    | Nenhum                  |
| Catacumbas        | Intermediário| Defesa dos heróis -20%  |
| Abismo Eterno     | Avançado     | Custo de Mana x2        |

## BOSSES

Cada mapa tem um Boss final com padrão de ataque único:
- **Ogre Sombrio** — Cargas rápidas + projéteis teleguiados
- **Lich** — Órbitas ao redor disparando espirais
- **Dragão das Sombras** — Explosões em leque de fogo
- **Deus do Abismo** — Todos os padrões combinados
