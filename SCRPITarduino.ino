#include <Wire.h>
#include <Keypad.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define TRAVA 21

#define MAX_REDES 2

struct RedeWiFi {
  const char* ssid;
  const char* senha;
};

RedeWiFi redes[MAX_REDES] = {
  {"ian", "12345678"},
  {"UNIFAN-VISITANTES", "UNIF4Nvisit"}
};

#define DATABASE_URL "https://trancaeletromag-default-rtdb.firebaseio.com"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

WiFiClientSecure cliente;
HTTPClient http;

bool firebasePronto = false;
bool wifiConectado = false;

String senhaUsuario = "1234";
String senhaAdmin = "D999";

String entrada = "";

int tentativas = 0;

bool bloqueado = false;
unsigned long inicioBloqueio = 0;

enum Estado {
  LOGIN,
  MENU,
  ALTERAR_SENHA
};

Estado estado = LOGIN;

enum EstadoTrava {
  TRAVADA,
  ABERTA
};

EstadoTrava estadoTrava = TRAVADA;
unsigned long inicioAbertura = 0;

String statusAnteriorTranca = "travada";
unsigned long ultimoPoll = 0;

const byte LINHAS = 4;
const byte COLUNAS = 4;

char teclas[LINHAS][COLUNAS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

byte rowPins[4] = {13,14,26,27};
byte colPins[4] = {16,17,5,18};

Keypad keypad = Keypad(
  makeKeymap(teclas),
  rowPins,
  colPins,
  LINHAS,
  COLUNAS
);

// ==================== REST FIREBASE ====================

String firebaseGet(const char* caminho)
{
  if(!firebasePronto) return "";
  String url = String(DATABASE_URL) + "/" + caminho + ".json";
  http.begin(cliente, url);
  int code = http.GET();
  String resp = "";
  if(code > 0) resp = http.getString();
  http.end();
  resp.trim();
  return resp;
}

int firebasePut(const char* caminho, const String& json)
{
  if(!firebasePronto) return -1;
  String url = String(DATABASE_URL) + "/" + caminho + ".json";
  http.begin(cliente, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(json);
  http.end();
  return code;
}

int firebasePost(const char* caminho, const String& json)
{
  if(!firebasePronto) return -1;
  String url = String(DATABASE_URL) + "/" + caminho + ".json";
  http.begin(cliente, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  http.end();
  return code;
}

String timestampStr()
{
  unsigned long ms = millis();
  return "t" + String(ms);
}

void firebaseRegistrarLog(const String& acao, const String& resultado, const String& origem)
{
  String json = "{\"usuario_id\":\"teclado\",\"usuario_login\":\"Teclado\","
    "\"acao\":\"" + acao + "\",\"resultado\":\"" + resultado + "\","
    "\"data_hora\":\"" + timestampStr() + "\",\"origem\":\"" + origem + "\"}";
  firebasePost("/logs", json);
}

void firebaseAtualizarStatus(const String& status, const String& acao)
{
  String json = "{\"status\":\"" + status + "\","
    "\"ultimaAtualizacao\":{"
    "\"usuario_id\":\"teclado\",\"usuario_login\":\"Teclado\","
    "\"acao\":\"" + acao + "\",\"data_hora\":\"" + timestampStr() + "\"}}";
  firebasePut("/tranca", json);
}

String firebaseLerStatus()
{
  String raw = firebaseGet("tranca/status");
  raw.replace("\"", "");
  raw.trim();
  return raw;
}

// ==================== WIFI ====================

void conectarWiFi()
{
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Conectando...");
  display.display();

  wifiConectado = false;
  cliente.setInsecure();

  for(int i = 0; i < MAX_REDES; i++)
  {
    display.setCursor(0,10);
    display.print("Tentando ");
    display.println(redes[i].ssid);
    display.display();

    WiFi.begin(redes[i].ssid, redes[i].senha);

    int tent = 0;
    while(WiFi.status() != WL_CONNECTED && tent < 20)
    {
      delay(500);
      display.print(".");
      display.display();
      tent++;
    }

    if(WiFi.status() == WL_CONNECTED)
    {
      wifiConectado = true;
      break;
    }
  }

  if(wifiConectado)
  {
    display.clearDisplay();
    display.setCursor(0,0);
    display.println("WiFi OK");
    display.println(WiFi.localIP().toString());
    display.display();
    delay(1500);
    firebasePronto = true;
  }
  else
  {
    display.clearDisplay();
    display.setCursor(0,0);
    display.println("WiFi falhou");
    display.println("Modo offline");
    display.display();
    delay(2000);
  }
}

// ==================== HARDWARE ====================

void telaLogin()
{
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Digite a senha");
  display.setCursor(0,20);
  for(int i=0;i<entrada.length();i++)
    display.print("*");
  display.display();
}

void telaMenu()
{
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("MENU ADMIN");
  display.println("1-Alterar");
  display.println("2-Tentativas");
  display.println("3-Reset");
  display.display();
}

void telaBloqueio()
{
  long restante = 30 - ((millis()-inicioBloqueio)/1000);
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("BLOQUEADO");
  display.print("Aguarde ");
  display.print(restante);
  display.print("s");
  display.display();
}

// ==================== TRAVA ====================

void abrirTrava()
{
  estadoTrava = ABERTA;
  inicioAbertura = millis();

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("ACESSO");
  display.println("LIBERADO");
  display.display();

  digitalWrite(TRAVA, HIGH);
}

void fecharTrava()
{
  digitalWrite(TRAVA, LOW);
  estadoTrava = TRAVADA;

  firebaseAtualizarStatus("travada", "travar");
  firebaseRegistrarLog("travar", "sucesso", "teclado");

  statusAnteriorTranca = "travada";
  entrada = "";
  telaLogin();
}

// ==================== SENHA ====================

void senhaErrada()
{
  tentativas++;

  firebaseRegistrarLog("senha_incorreta", "erro", "teclado");

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Senha");
  display.println("Invalida");
  display.display();

  delay(2000);

  if(tentativas >= 3)
  {
    bloqueado = true;
    inicioBloqueio = millis();
  }
}

// ==================== SETUP ====================

void setup()
{
  pinMode(TRAVA,OUTPUT);

  digitalWrite(TRAVA,LOW);

  Wire.begin(25,19);

  display.begin(SSD1306_SWITCHCAPVCC,0x3C);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  conectarWiFi();

  if(firebasePronto)
  {
    String s = firebaseLerStatus();
    if(s == "destravada" && estadoTrava == TRAVADA)
    {
      statusAnteriorTranca = "destravada";
      abrirTrava();
    }
    else
      statusAnteriorTranca = "travada";
  }

  telaLogin();
}

// ==================== LOOP ====================

void loop()
{
  // --- Polling Firebase (cada 2s) ---
  if(firebasePronto && millis() - ultimoPoll >= 2000)
  {
    ultimoPoll = millis();
    String s = firebaseLerStatus();
    if(s == "destravada" && statusAnteriorTranca == "travada" && estadoTrava == TRAVADA)
      abrirTrava();
    statusAnteriorTranca = s;
  }

  // --- Bloqueado ---
  if(bloqueado)
  {
    telaBloqueio();

    if(millis()-inicioBloqueio >= 30000)
    {
      bloqueado = false;
      tentativas = 0;
      entrada = "";
      telaLogin();
    }

    return;
  }

  // --- Trava aberta (contagem 5s) ---
  if(estadoTrava == ABERTA)
  {
    if(millis()-inicioAbertura >= 5000)
      fecharTrava();
    return;
  }

  // --- Teclado ---
  char tecla = keypad.getKey();

  if(!tecla) return;

  switch(estado)
  {
    case LOGIN:

      if((tecla >= '0' && tecla <= '9') || (tecla >= 'A' && tecla <= 'D'))
      {
        entrada += tecla;
        telaLogin();
      }

      if(tecla == '*')
      {
        entrada = "";
        telaLogin();
      }

      if(tecla == '#')
      {
        if(entrada == senhaUsuario)
        {
          tentativas = 0;
          statusAnteriorTranca = "destravada";
          firebaseAtualizarStatus("destravada", "abrir");
          firebaseRegistrarLog("abertura_senha", "sucesso", "teclado");
          abrirTrava();
          entrada = "";
          return;
        }
        else if(entrada == senhaAdmin)
        {
          estado = MENU;
          telaMenu();
        }
        else
        {
          senhaErrada();
        }

        entrada = "";
        telaLogin();
      }

      break;

    case MENU:

      if(tecla == '1')
      {
        estado = ALTERAR_SENHA;

        display.clearDisplay();
        display.setCursor(0,0);
        display.println("Nova senha:");
        display.display();

        entrada = "";
      }

      if(tecla == '2')
      {
        display.clearDisplay();

        display.setCursor(0,0);
        display.print("Tentativas:");

        display.setCursor(0,20);
        display.print(tentativas);

        display.display();

        delay(3000);

        telaMenu();
      }

      if(tecla == '3')
      {
        senhaUsuario = "1234";

        display.clearDisplay();

        display.setCursor(0,0);
        display.println("Senha resetada");

        display.display();

        delay(2000);

        telaMenu();
      }

      if(tecla == 'D')
      {
        estado = LOGIN;
        telaLogin();
      }

      break;

    case ALTERAR_SENHA:

      if((tecla >= '0' && tecla <= '9') || (tecla >= 'A' && tecla <= 'D'))
      {
        entrada += tecla;

        display.clearDisplay();

        display.setCursor(0,0);
        display.println("Nova senha");

        display.setCursor(0,20);

        for(int i=0;i<entrada.length();i++)
          display.print("*");

        display.display();
      }

      if(tecla == '*')
      {
        entrada = "";

        display.clearDisplay();
        display.setCursor(0,0);
        display.println("Nova senha");
        display.display();
      }

      if(tecla == '#')
      {
        senhaUsuario = entrada;

        display.clearDisplay();

        display.setCursor(0,0);
        display.println("Senha alterada");

        display.display();

        delay(2000);

        entrada = "";

        estado = MENU;
        telaMenu();
      }

      break;
  }
}
