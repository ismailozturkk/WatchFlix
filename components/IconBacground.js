import React, { useMemo } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const IconBacground = ({ opacity = 0.5 }) => {
  const patternImages = [
    require("../assets/iconBacground/1.png"),
    require("../assets/iconBacground/2.png"),
    require("../assets/iconBacground/3.png"),
    require("../assets/iconBacground/4.png"),
    require("../assets/iconBacground/5.png"),
    require("../assets/iconBacground/6.png"),
    require("../assets/iconBacground/7.png"),
    require("../assets/iconBacground/8.png"),
    require("../assets/iconBacground/9.png"),
    require("../assets/iconBacground/10.png"),
    require("../assets/iconBacground/11.png"),
    require("../assets/iconBacground/12.png"),
    require("../assets/iconBacground/13.png"),
    require("../assets/iconBacground/14.png"),
    require("../assets/iconBacground/15.png"),
    require("../assets/iconBacground/16.png"),
    require("../assets/iconBacground/17.png"),
    require("../assets/iconBacground/18.png"),
    require("../assets/iconBacground/19.png"),
    require("../assets/iconBacground/20.png"),
    require("../assets/iconBacground/21.png"),
    require("../assets/iconBacground/22.png"),
    require("../assets/iconBacground/23.png"),
    require("../assets/iconBacground/24.png"),
    require("../assets/iconBacground/25.png"),
    require("../assets/iconBacground/26.png"),
    require("../assets/iconBacground/27.png"),
    require("../assets/iconBacground/28.png"),
    require("../assets/iconBacground/29.png"),
    require("../assets/iconBacground/30.png"),
    require("../assets/iconBacground/31.png"),
    require("../assets/iconBacground/32.png"),
    require("../assets/iconBacground/33.png"),
    require("../assets/iconBacground/34.png"),
    require("../assets/iconBacground/35.png"),
    require("../assets/iconBacground/36.png"),
    require("../assets/iconBacground/37.png"),
    require("../assets/iconBacground/38.png"),
    require("../assets/iconBacground/39.png"),
    require("../assets/iconBacground/40.png"),
    require("../assets/iconBacground/41.png"),
    require("../assets/iconBacground/42.png"),
    require("../assets/iconBacground/43.png"),
    require("../assets/iconBacground/44.png"),
    require("../assets/iconBacground/45.png"),
    require("../assets/iconBacground/46.png"),
    require("../assets/iconBacground/47.png"),
    require("../assets/iconBacground/48.png"),
    require("../assets/iconBacground/49.png"),
    require("../assets/iconBacground/50.png"),
    require("../assets/iconBacground/51.png"),
    require("../assets/iconBacground/52.png"),
    require("../assets/iconBacground/53.png"),
    require("../assets/iconBacground/54.png"),
    require("../assets/iconBacground/55.png"),
    require("../assets/iconBacground/56.png"),
    require("../assets/iconBacground/57.png"),
    require("../assets/iconBacground/58.png"),
    require("../assets/iconBacground/59.png"),
    require("../assets/iconBacground/60.png"),
    require("../assets/iconBacground/61.png"),
    require("../assets/iconBacground/62.png"),
    require("../assets/iconBacground/63.png"),
    require("../assets/iconBacground/64.png"),
    require("../assets/iconBacground/65.png"),
    require("../assets/iconBacground/66.png"),
    require("../assets/iconBacground/67.png"),
    require("../assets/iconBacground/68.png"),
    require("../assets/iconBacground/69.png"),
    require("../assets/iconBacground/70.png"),
    require("../assets/iconBacground/71.png"),
    require("../assets/iconBacground/72.png"),
    require("../assets/iconBacground/73.png"),
    require("../assets/iconBacground/74.png"),
    require("../assets/iconBacground/75.png"),
    require("../assets/iconBacground/76.png"),
    require("../assets/iconBacground/77.png"),
    require("../assets/iconBacground/78.png"),
    require("../assets/iconBacground/79.png"),
    require("../assets/iconBacground/80.png"),
    require("../assets/iconBacground/81.png"),
    require("../assets/iconBacground/82.png"),
    require("../assets/iconBacground/83.png"),
    require("../assets/iconBacground/84.png"),
    require("../assets/iconBacground/85.png"),
    require("../assets/iconBacground/86.png"),
    require("../assets/iconBacground/87.png"),
    require("../assets/iconBacground/88.png"),
    require("../assets/iconBacground/89.png"),
    require("../assets/iconBacground/90.png"),
    require("../assets/iconBacground/91.png"),
    require("../assets/iconBacground/92.png"),
    require("../assets/iconBacground/93.png"),
    require("../assets/iconBacground/94.png"),
    require("../assets/iconBacground/95.png"),
    require("../assets/iconBacground/96.png"),
    require("../assets/iconBacground/97.png"),
    require("../assets/iconBacground/98.png"),
    require("../assets/iconBacground/99.png"),
    require("../assets/iconBacground/100.png"),
    require("../assets/iconBacground/101.png"),
    require("../assets/iconBacground/102.png"),
    require("../assets/iconBacground/103.png"),
    require("../assets/iconBacground/104.png"),
    require("../assets/iconBacground/105.png"),
    require("../assets/iconBacground/106.png"),
    require("../assets/iconBacground/107.png"),
    require("../assets/iconBacground/108.png"),
    require("../assets/iconBacground/109.png"),
    require("../assets/iconBacground/110.png"),
    require("../assets/iconBacground/111.png"),
    require("../assets/iconBacground/112.png"),
    require("../assets/iconBacground/113.png"),
    require("../assets/iconBacground/114.png"),
    require("../assets/iconBacground/115.png"),
    require("../assets/iconBacground/116.png"),
    require("../assets/iconBacground/117.png"),
    require("../assets/iconBacground/118.png"),
    require("../assets/iconBacground/119.png"),
    require("../assets/iconBacground/120.png"),
    require("../assets/iconBacground/121.png"),
    require("../assets/iconBacground/122.png"),
    require("../assets/iconBacground/123.png"),
    require("../assets/iconBacground/124.png"),
    require("../assets/iconBacground/125.png"),
    require("../assets/iconBacground/126.png"),
    require("../assets/iconBacground/127.png"),
    require("../assets/iconBacground/128.png"),
    require("../assets/iconBacground/129.png"),
    require("../assets/iconBacground/130.png"),
    require("../assets/iconBacground/131.png"),
    require("../assets/iconBacground/132.png"),
    require("../assets/iconBacground/133.png"),
    require("../assets/iconBacground/134.png"),
    require("../assets/iconBacground/135.png"),
    require("../assets/iconBacground/136.png"),
    require("../assets/iconBacground/137.png"),
    require("../assets/iconBacground/138.png"),
    require("../assets/iconBacground/139.png"),
    require("../assets/iconBacground/140.png"),
    require("../assets/iconBacground/141.png"),
    require("../assets/iconBacground/142.png"),
    require("../assets/iconBacground/143.png"),
    require("../assets/iconBacground/144.png"),
    require("../assets/iconBacground/145.png"),
    require("../assets/iconBacground/146.png"),
    require("../assets/iconBacground/147.png"),
    require("../assets/iconBacground/148.png"),
    require("../assets/iconBacground/149.png"),
    require("../assets/iconBacground/150.png"),
    require("../assets/iconBacground/151.png"),
    require("../assets/iconBacground/152.png"),
    require("../assets/iconBacground/153.png"),
    require("../assets/iconBacground/154.png"),
    require("../assets/iconBacground/155.png"),
    require("../assets/iconBacground/156.png"),
    require("../assets/iconBacground/157.png"),
    require("../assets/iconBacground/158.png"),
    require("../assets/iconBacground/159.png"),
    require("../assets/iconBacground/160.png"),
    require("../assets/iconBacground/161.png"),
    require("../assets/iconBacground/162.png"),
    require("../assets/iconBacground/163.png"),
    require("../assets/iconBacground/164.png"),
    require("../assets/iconBacground/165.png"),
    require("../assets/iconBacground/166.png"),
    require("../assets/iconBacground/167.png"),
    require("../assets/iconBacground/168.png"),
    require("../assets/iconBacground/169.png"),
    require("../assets/iconBacground/170.png"),
    require("../assets/iconBacground/171.png"),
    require("../assets/iconBacground/172.png"),
    require("../assets/iconBacground/173.png"),
    require("../assets/iconBacground/174.png"),
  ];
  const opacityValue = opacity; // Varsayılan opaklık değeri

  // Izgara (Grid) mantığı ile öğeleri dağıtıyoruz (Üst üste binmeyi önlemek ve boşlukları doldurmak için)
  const items = useMemo(() => {
    const cols = 5; // Ekranı yatayda 5 bölmeye ayırıyoruz
    const rows = 9; // Ekranı dikeyde 9 bölmeye ayırıyoruz
    const cellWidth = SCREEN_WIDTH / cols;
    const cellHeight = SCREEN_HEIGHT / rows;
    const generatedItems = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const size = Math.random() * 15 + 25; // 25px - 40px arası daha küçük ve zarif boyutlar

        // Her hücrenin (cell) sol üst köşesini baz alıp, hücre içinde rastgele kaydırıyoruz
        // Hücre sınırları dışına çıkmaması için 'size' değerini hesaba katıyoruz
        const top = r * cellHeight + Math.random() * (cellHeight - size);
        const left = c * cellWidth + Math.random() * (cellWidth - size);

        const opacity = opacityValue; // Arka planda çok hafif ve derinlikli durması için
        const imgIndex = Math.floor(Math.random() * patternImages.length);

        generatedItems.push({ top, left, size, opacity, imgIndex });
      }
    }
    // Diziyi karıştırıyoruz ki görsel sıralama tamamen rastgele görünsün
    return generatedItems.sort(() => Math.random() - 0.5);
  }, []);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* <View
        style={{
          width: "100%",
          height: 50,
          flexDirection: "row",
          justifyContent: "center",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {[...Array(10)].map((_, index) => (
          <Image
            key={index}
            source={patternImages[1]}
            style={{ width: "10%", height: "100%", opacity: 0.15 }}
          />
        ))}
      </View> */}

      {/* Rastgele dağıtılmış desenler */}
      {items.map((item, index) => (
        <View
          key={index}
          style={{
            width: item.size,
            height: item.size,
            position: "absolute",
            top: item.top,
            left: item.left,
            opacity: opacityValue,
          }}
        >
          <Image
            source={patternImages[item.imgIndex]}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
      ))}
    </View>
  );
};

export default IconBacground;

const styles = StyleSheet.create({});
