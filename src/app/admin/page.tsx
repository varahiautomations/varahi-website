"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Product {
  id: number;
  name: string;
  image_url: string;
}

export default function AdminPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);

  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);

  // Check auth
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        setCheckingAuth(false);
      }
    };

    checkUser();
  }, [router]);

  // Fetch products
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data);
    }
  };

  useEffect(() => {
    if (!checkingAuth) {
      fetchProducts();
    }
  }, [checkingAuth]);

  // Upload product
  const handleUpload = async () => {
    if (!image || !name) {
      alert("Please provide image and product name");
      return;
    }

    setLoading(true);

    const fileName = `${Date.now()}-${image.name}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, image);

    if (uploadError) {
      console.error(uploadError);
      alert("Upload failed");
      setLoading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    const { error: dbError } = await supabase
      .from("products")
      .insert([
        {
          name,
          image_url: imageUrl,
        },
      ]);

    if (dbError) {
      console.error(dbError);
      alert("Database insert failed");
      setLoading(false);
      return;
    }

    setName("");
    setImage(null);

    fetchProducts();

    alert("Product uploaded");

    setLoading(false);
  };

// Update product
const handleUpdate = async (id: number) => {
  try {
    let updatedImageUrl: string | null = null;
    let oldImagePath: string | null = null;

    // Get old image URL
    const { data: oldProduct, error: fetchError } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error(fetchError);
      alert("Could not find product");
      return;
    }

    // Upload new image if selected
    if (editImage) {
      const fileName = `${Date.now()}-${editImage.name}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, editImage);

      if (uploadError) {
        console.error(uploadError);
        alert("Image upload failed");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      updatedImageUrl = publicUrlData.publicUrl;

      // Extract old image filename
      if (oldProduct?.image_url) {
        oldImagePath = oldProduct.image_url
          .split("/")
          .pop()
          ?.split("?")[0] || null;
      }
    }

    const updateData: {
      name: string;
      image_url?: string;
    } = {
      name: editName,
    };

    if (updatedImageUrl) {
      updateData.image_url = updatedImageUrl;
    }

    // Update database
    const { error: updateError } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error(updateError);
      alert("Update failed");
      return;
    }

    // Delete old image
    if (oldImagePath) {
      await supabase.storage
        .from("product-images")
        .remove([oldImagePath]);
    }

    setEditingId(null);
    setEditName("");
    setEditImage(null);

    fetchProducts();

    alert("Product updated successfully");

  } catch (error) {
    console.error(error);
    alert("Something went wrong");
  }
};

// Delete product
const handleDelete = async (id: number) => {
  const confirmDelete = confirm("Delete this product?");

  if (!confirmDelete) return;

  try {
    // 1. Get product image URL before deleting the database row
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error(fetchError);
      alert("Could not find product");
      return;
    }

// 2. Delete product row from database
const { error: deleteError } = await supabase
  .from("products")
  .delete()
  .eq("id", id);

if (deleteError) {
  console.error(deleteError);
  alert("Product deletion failed");
  return;
}

// 3. Delete image from Supabase Storage
if (product?.image_url) {
  const imagePath = product.image_url
    .split("/")
    .pop()
    ?.split("?")[0];

  if (imagePath) {
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove([imagePath]);

    if (storageError) {
      console.error(storageError);
    }
  }
}

    // 4. Refresh products list
    fetchProducts();

    alert("Product deleted successfully");

  } catch (error) {
    console.error(error);
    alert("Something went wrong while deleting");
  }
};

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();

    router.push("/login");
  };

  if (checkingAuth) {
    return <div style={{ padding: "40px" }}>Checking auth...</div>;
  }

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
          }}
        >
          Admin Panel
        </h1>

        <button
          onClick={handleLogout}
          style={{
            padding: "10px 20px",
            background: "black",
            color: "white",
            borderRadius: "8px",
          }}
        >
          Logout
        </button>
      </div>

      {/* Upload Form */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          marginBottom: "50px",
          maxWidth: "400px",
        }}
      >
        <input
          type="text"
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            padding: "12px",
            border: "1px solid black",
            borderRadius: "8px",
            background: "white",
            color: "black",
          }}
        />

        <input
          type="file"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setImage(e.target.files[0]);
            }
          }}
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          style={{
            padding: "12px",
            background: "black",
            color: "white",
            borderRadius: "8px",
          }}
        >
          {loading ? "Uploading..." : "Upload Product"}
        </button>
      </div>

      {/* Product Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px",
              background: "white",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "180px",
              }}
            >
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                unoptimized
                style={{ objectFit: "contain" }}
              />
            </div>

            {editingId === product.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    marginTop: "15px",
                    padding: "10px",
                    width: "100%",
                    border: "1px solid black",
                    color: "black",
                    background: "white",
                  }}
                />

                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setEditImage(e.target.files[0]);
                    }
                  }}
                  style={{
                    marginTop: "10px",
                  }}
                />

                <button
                  onClick={() => handleUpdate(product.id)}
                  style={{
                    marginTop: "10px",
                    padding: "10px",
                    width: "100%",
                    background: "green",
                    color: "white",
                    borderRadius: "8px",
                  }}
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <h3
                  style={{
                    marginTop: "15px",
                    fontWeight: "bold",
                    color: "black",
                  }}
                >
                  {product.name}
                </h3>

                <button
                  onClick={() => {
                    setEditingId(product.id);
                    setEditName(product.name);
                  }}
                  style={{
                    marginTop: "10px",
                    padding: "10px",
                    width: "100%",
                    background: "orange",
                    color: "white",
                    borderRadius: "8px",
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(product.id)}
                  style={{
                    marginTop: "10px",
                    padding: "10px",
                    width: "100%",
                    background: "red",
                    color: "white",
                    borderRadius: "8px",
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
